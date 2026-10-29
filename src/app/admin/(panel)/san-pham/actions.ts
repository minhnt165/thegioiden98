"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { COLORS, MATERIALS, SPACES } from "@/lib/shop/filters";
import { sanitizeRichText } from "@/lib/shop/richtext";
import { SLUG_PATTERN } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const MAX_IMAGES = 9;
const money = z.number({ error: "Giá phải là số." }).int().min(0, "Giá không được âm.").max(10_000_000_000, "Giá quá lớn.");

const productSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Nhập tên sản phẩm.").max(120, "Tên tối đa 120 ký tự."),
  slug: z.string().trim().regex(SLUG_PATTERN, "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang."),
  categoryId: z.union([z.uuid(), z.literal("")]),
  description: z.string().max(20_000),
  material: z.string().trim().max(120),
  dimensions: z.string().trim().max(120),
  bulb: z.string().trim().max(120),
  extraSpecs: z.array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(160) })).max(12),
  careInstructions: z.string().trim().max(500),
  compareAtPrice: money.nullable(),
  status: z.enum(["draft", "active", "hidden"]),
  isFeatured: z.boolean(),
  badge: z.enum(["none", "bestseller", "new"]),
  lowStockThreshold: z.number().int().min(0).max(9999).nullable(),
  materialTags: z.array(z.enum(MATERIALS.map((m) => m.value) as [string, ...string[]])),
  colorTags: z.array(z.enum(COLORS.map((c) => c.value) as [string, ...string[]])),
  spaces: z.array(z.enum(SPACES.map((s) => s.value) as [string, ...string[]])),
  seoDescription: z.string().trim().max(300, "Mô tả ngắn tối đa 300 ký tự."),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Tên nhóm phân loại không được trống.").max(40),
        values: z
          .array(
            z.object({
              value: z.string().trim().min(1).max(60),
              hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
            }),
          )
          .min(1, "Mỗi nhóm phân loại cần ít nhất 1 giá trị.")
          .max(30),
      }),
    )
    .max(3, "Tối đa 3 nhóm phân loại."),
  variants: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        sku: z.string().trim().min(1, "Mỗi phân loại cần SKU.").max(60),
        price: money,
        stock: z.number().int().min(0, "Tồn kho không được âm.").max(1_000_000),
        isActive: z.boolean(),
        optionValues: z.record(z.string(), z.string()),
      }),
    )
    .min(1, "Cần ít nhất 1 phân loại (SKU)."),
  images: z.array(z.object({ path: z.string().min(1) })).max(MAX_IMAGES, `Tối đa ${MAX_IMAGES} ảnh.`),
});

export type ProductPayload = z.input<typeof productSchema>;

function checkConsistency(p: z.infer<typeof productSchema>): string | null {
  const optionNames = p.options.map((o) => o.name.toLowerCase());
  if (new Set(optionNames).size !== optionNames.length) return "Tên nhóm phân loại bị trùng.";
  for (const o of p.options) {
    const values = o.values.map((v) => v.value.toLowerCase());
    if (new Set(values).size !== values.length) return `Nhóm "${o.name}" có giá trị bị trùng.`;
  }
  const skus = p.variants.map((v) => v.sku.toUpperCase());
  const duplicate = skus.find((s, i) => skus.indexOf(s) !== i);
  if (duplicate) return `SKU "${duplicate}" bị trùng giữa các phân loại.`;
  for (const v of p.variants) {
    for (const o of p.options) {
      if (!o.values.some((x) => x.value === v.optionValues[o.name])) return `Phân loại SKU ${v.sku} thiếu giá trị "${o.name}".`;
    }
  }
  if (p.images.some((img) => !img.path.startsWith(`${p.id}/`))) return "Ảnh không thuộc sản phẩm này.";
  return null;
}

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505" && error.message.includes("products_slug_key")) return "Đường dẫn này đã được sản phẩm khác dùng.";
  if (error.code === "23505" && error.message.includes("product_variants_sku_key")) return "Có SKU đã được dùng ở sản phẩm khác.";
  if (error.code === "42501") return "Tài khoản không có quyền sửa sản phẩm.";
  if (error.code === "PGRST202") return "Chưa có hàm lưu sản phẩm — hãy chạy migration 20261029000005_admin_products.sql.";
  return `Lưu chưa được: ${error.message}`;
}

export async function saveProduct(input: ProductPayload): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const p = parsed.data;
  const problem = checkConsistency(p);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("products")
    .select("slug, product_images(storage_path)")
    .eq("id", p.id)
    .maybeSingle();

  // Giá "từ" trên cửa hàng = giá thấp nhất trong các phân loại đang bán
  const activePrices = p.variants.filter((v) => v.isActive).map((v) => v.price);
  const basePrice = Math.min(...(activePrices.length ? activePrices : p.variants.map((v) => v.price)));

  const { error } = await supabase.rpc("admin_save_product", {
    p: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category_id: p.categoryId,
      description: sanitizeRichText(p.description),
      material: p.material,
      dimensions: p.dimensions,
      bulb: p.bulb,
      extra_specs: p.extraSpecs.filter((s) => s.label && s.value),
      care_instructions: p.careInstructions,
      base_price: basePrice,
      compare_at_price: p.compareAtPrice,
      status: p.status,
      is_featured: p.isFeatured,
      badge: p.badge,
      low_stock_threshold: p.lowStockThreshold,
      material_tags: p.materialTags,
      color_tags: p.colorTags,
      spaces: p.spaces,
      seo_description: p.seoDescription,
      options: p.options,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        is_active: v.isActive,
        option_values: Object.fromEntries(p.options.map((o) => [o.name, v.optionValues[o.name]])),
      })),
      images: p.images.map((img) => ({ storage_path: img.path })),
    },
  });
  if (error) return { ok: false, error: translateDbError(error) };

  // Xóa file ảnh đã gỡ khỏi sản phẩm (không để rác trong Storage)
  const kept = new Set(p.images.map((img) => img.path));
  const removed = (existing?.product_images ?? []).map((img) => img.storage_path).filter((path) => !kept.has(path));
  if (removed.length) {
    const { error: storageError } = await supabase.storage.from("products").remove(removed);
    if (storageError) console.error("Không xóa được ảnh cũ:", storageError);
  }

  updateTag("products");
  updateTag(`product:${p.slug}`);
  if (existing?.slug && existing.slug !== p.slug) updateTag(`product:${existing.slug}`);

  return { ok: true, data: { id: p.id, slug: p.slug } };
}

const statusSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  status: z.enum(["draft", "active", "hidden"]),
});

/** Đổi trạng thái 1 hoặc nhiều sản phẩm (công tắc hiển thị, thao tác hàng loạt). Không xóa cứng. */
export async function setProductsStatus(ids: string[], status: "draft" | "active" | "hidden"): Promise<ActionResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({ ids, status });
  if (!parsed.success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").update({ status }).in("id", parsed.data.ids).select("slug");
  if (error) return { ok: false, error: `Chưa đổi được trạng thái: ${error.message}` };

  updateTag("products");
  for (const row of data ?? []) updateTag(`product:${row.slug}`);
  return { ok: true, data: undefined };
}
