"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/(panel)/san-pham/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { LOCKED_CATEGORY_SLUGS } from "@/lib/admin/categories";
import { SLUG_PATTERN } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const categorySchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Nhập tên danh mục.").max(80, "Tên danh mục tối đa 80 ký tự."),
  slug: z.string().trim().max(80, "Đường dẫn tối đa 80 ký tự.").regex(SLUG_PATTERN, "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang."),
  parentId: z.uuid().nullable(),
  description: z.string().trim().max(500, "Mô tả tối đa 500 ký tự."),
});

export type CategoryPayload = z.input<typeof categorySchema>;

/** Cửa hàng đọc danh mục qua "use cache" (tag categories); tên danh mục cũng nằm trong dữ liệu sản phẩm */
function revalidateShop() {
  updateTag("categories");
  updateTag("products");
  refresh();
}

/** Thêm / sửa danh mục. Chỉ 2 cấp: danh mục con phải nằm dưới một danh mục gốc. */
export async function saveCategory(input: CategoryPayload): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const c = parsed.data;
  const supabase = await createClient();

  if (c.parentId) {
    if (c.parentId === c.id) return { ok: false, error: "Danh mục không thể nằm trong chính nó." };
    const { data: parent } = await supabase.from("categories").select("parent_id").eq("id", c.parentId).maybeSingle();
    if (!parent) return { ok: false, error: "Không tìm thấy danh mục cha." };
    if (parent.parent_id) return { ok: false, error: "Chỉ chọn được danh mục gốc làm danh mục cha (tối đa 2 cấp)." };
  }

  if (c.id) {
    const [{ data: current }, { count: children }] = await Promise.all([
      supabase.from("categories").select("slug").eq("id", c.id).maybeSingle(),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", c.id),
    ]);
    if (!current) return { ok: false, error: "Không tìm thấy danh mục." };
    if (current.slug !== c.slug && LOCKED_CATEGORY_SLUGS.has(current.slug)) {
      return { ok: false, error: "Danh mục này đang có trên menu cửa hàng nên không đổi được đường dẫn." };
    }
    if (c.parentId && children) return { ok: false, error: "Danh mục đang có danh mục con nên không chuyển thành danh mục con được." };
  }

  const row = { name: c.name, slug: c.slug, parent_id: c.parentId, description: c.description || null };
  let id = c.id;
  if (id) {
    const { error } = await supabase.from("categories").update(row).eq("id", id);
    if (error) return { ok: false, error: dbError(error) };
  } else {
    // Danh mục mới xếp cuối nhóm cùng cấp
    const siblings = supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const { data: last } = await (c.parentId ? siblings.eq("parent_id", c.parentId) : siblings.is("parent_id", null));
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...row, sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbError(error) };
    id = data.id;
  }

  revalidateShop();
  return { ok: true, data: { id } };
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Đường dẫn này đã có danh mục khác dùng.";
  return `Chưa lưu được danh mục: ${error.message}`;
}

/** Xóa danh mục trống: không còn sản phẩm, không còn danh mục con, không nằm trên menu cửa hàng */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };
  const supabase = await createClient();

  const [{ data: category }, { count: products }, { count: children }] = await Promise.all([
    supabase.from("categories").select("slug").eq("id", id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id),
  ]);
  if (!category) return { ok: false, error: "Không tìm thấy danh mục." };
  if (LOCKED_CATEGORY_SLUGS.has(category.slug)) return { ok: false, error: "Danh mục đang có trên menu cửa hàng nên không xóa được." };
  if (children) return { ok: false, error: "Còn danh mục con — xóa hoặc chuyển chúng trước." };
  // Khóa ngoại products.category_id là "set null": chặn ở đây để sản phẩm không bị rơi khỏi danh mục
  if (products) return { ok: false, error: `Còn ${products} sản phẩm trong danh mục — chuyển sang danh mục khác trước.` };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: `Chưa xóa được danh mục: ${error.message}` };
  revalidateShop();
  return { ok: true, data: undefined };
}

/** Đổi chỗ với danh mục cùng cấp đứng trước / sau, rồi đánh lại thứ tự 1..n cho cả nhóm */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };
  const supabase = await createClient();

  const { data: category } = await supabase.from("categories").select("parent_id").eq("id", id).maybeSingle();
  if (!category) return { ok: false, error: "Không tìm thấy danh mục." };
  const query = supabase.from("categories").select("id").order("sort_order").order("name");
  const { data: siblings, error } = await (category.parent_id ? query.eq("parent_id", category.parent_id) : query.is("parent_id", null));
  if (error) return { ok: false, error: error.message };

  const ids = siblings.map((s) => s.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true, data: undefined };
  [ids[from], ids[to]] = [ids[to], ids[from]];

  const results = await Promise.all(ids.map((cid, i) => supabase.from("categories").update({ sort_order: i + 1 }).eq("id", cid)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: `Chưa đổi được thứ tự: ${failed.error.message}` };
  revalidateShop();
  return { ok: true, data: undefined };
}
