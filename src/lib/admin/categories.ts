import "server-only";

import { HOME_CATEGORIES, MAIN_NAV } from "@/components/shop/nav";
import { createClient } from "@/lib/supabase/server";

// Danh mục cho trang /admin/danh-muc (đọc theo phiên đăng nhập, RLS chỉ cho admin)

/**
 * Slug đang được dùng cứng ở cửa hàng: menu chính, ô danh mục trang chủ / footer (components/shop/nav.ts)
 * và hình minh họa theo danh mục (artKindFor trong ProductArt.tsx). Đổi slug hoặc xóa sẽ làm gãy link.
 */
export const LOCKED_CATEGORY_SLUGS = new Set<string>([
  ...MAIN_NAV.map((n) => n.href.match(/^\/danh-muc\/([^/?#]+)/)?.[1]).filter((s): s is string => Boolean(s)),
  ...HOME_CATEGORIES.map((c) => c.slug),
  "den-tuong",
]);

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  sortOrder: number;
  /** Sản phẩm gắn trực tiếp vào danh mục (mọi trạng thái) */
  productCount: number;
  childCount: number;
  locked: boolean;
};

/** Danh mục theo thứ tự hiển thị: mỗi danh mục gốc rồi tới các danh mục con của nó */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const [categoriesRes, productsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, parent_id, description, sort_order").order("sort_order").order("name"),
    supabase.from("products").select("category_id").not("category_id", "is", null),
  ]);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const productCount = new Map<string, number>();
  for (const p of productsRes.data) productCount.set(p.category_id!, (productCount.get(p.category_id!) ?? 0) + 1);

  const all = categoriesRes.data.map(
    (c): AdminCategory => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id,
      description: c.description ?? "",
      sortOrder: c.sort_order,
      productCount: productCount.get(c.id) ?? 0,
      childCount: categoriesRes.data.filter((x) => x.parent_id === c.id).length,
      locked: LOCKED_CATEGORY_SLUGS.has(c.slug),
    }),
  );
  const ids = new Set(all.map((c) => c.id));
  // Danh mục con có cha không còn tồn tại (không xảy ra nhờ khóa ngoại) vẫn được xếp như danh mục gốc
  const roots = all.filter((c) => !c.parentId || !ids.has(c.parentId));
  return roots.flatMap((root) => [root, ...all.filter((c) => c.parentId === root.id)]);
}
