import "server-only";

import { createClient } from "@/lib/supabase/server";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums, Json } from "@/types/database";
import { ADMIN_PAGE_SIZE, PRODUCT_TABS, type AdminProductQuery, type Tab } from "./product-filters";

// Dữ liệu sản phẩm cho admin (đọc theo phiên đăng nhập, RLS cho admin thấy mọi trạng thái)

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  status: Enums<"product_status">;
  categoryId: string | null;
  categoryName: string | null;
  skuHint: string;
  variantSummary: string;
  variantCount: number;
  minPrice: number;
  maxPrice: number;
  stock: number;
  threshold: number;
  sold: number;
  coverPath: string | null;
  updatedAt: string;
};

function matchesTab(row: AdminProductRow, tab: Tab) {
  switch (tab) {
    case "dang-ban":
      return row.status === "active" && row.stock > 0;
    case "het-hang":
      return row.status === "active" && row.stock <= 0;
    case "da-an":
      return row.status === "hidden";
    case "nhap":
      return row.status === "draft";
    default:
      return true;
  }
}

function commonPrefix(skus: string[]): string {
  if (!skus.length) return "";
  let prefix = skus[0];
  for (const s of skus.slice(1)) while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.replace(/[-_]+$/, "");
}

export async function getAdminProducts(query: AdminProductQuery) {
  const supabase = await createClient();
  const [productsRes, salesRes, categoriesRes, thresholdRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, status, category_id, updated_at, low_stock_threshold, category:categories(name), product_options(name, product_option_values(id)), product_variants(sku, price, stock, is_active), product_images(storage_path, is_cover, sort_order)",
      ),
    supabase.from("product_sales").select("product_id, sold"),
    supabase.from("categories").select("id, name, parent_id, sort_order").order("sort_order"),
    supabase.from("settings").select("value").eq("key", "low_stock_threshold").maybeSingle(),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const sold = new Map((salesRes.data ?? []).map((s) => [s.product_id, s.sold ?? 0]));
  const defaultThreshold = typeof thresholdRes.data?.value === "number" ? thresholdRes.data.value : 3;

  const rows: AdminProductRow[] = (productsRes.data ?? []).map((p) => {
    const active = p.product_variants.filter((v) => v.is_active);
    const prices = (active.length ? active : p.product_variants).map((v) => v.price);
    const cover = [...p.product_images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      categoryId: p.category_id,
      categoryName: (p.category as { name: string } | null)?.name ?? null,
      skuHint: commonPrefix(p.product_variants.map((v) => v.sku)),
      variantSummary: p.product_options.length
        ? p.product_options.map((o) => `${o.product_option_values.length} ${o.name.toLowerCase()}`).join(" · ")
        : "Không phân loại",
      variantCount: p.product_variants.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      stock: active.reduce((s, v) => s + v.stock, 0),
      threshold: p.low_stock_threshold ?? defaultThreshold,
      sold: sold.get(p.id) ?? 0,
      coverPath: cover?.storage_path ?? null,
      updatedAt: p.updated_at,
    };
  });

  const counts = Object.fromEntries(PRODUCT_TABS.map((t) => [t.value, rows.filter((r) => matchesTab(r, t.value)).length])) as Record<Tab, number>;

  const categories = categoriesRes.data ?? [];
  const categoryIds = query.category
    ? new Set([query.category, ...categories.filter((c) => c.parent_id === query.category).map((c) => c.id)])
    : null;
  const needle = foldVietnamese(query.q);

  const filtered = rows
    .filter((r) => matchesTab(r, query.tab))
    .filter((r) => !categoryIds || (r.categoryId && categoryIds.has(r.categoryId)))
    .filter((r) => (query.stock === "het" ? r.stock <= 0 : query.stock === "sap-het" ? r.stock > 0 && r.stock <= r.threshold : true))
    .filter((r) => !needle || foldVietnamese(`${r.name} ${r.skuHint}`).includes(needle))
    .sort((a, b) => {
      switch (query.sort) {
        case "ban-chay":
          return b.sold - a.sold;
        case "gia-tang":
          return a.minPrice - b.minPrice;
        case "gia-giam":
          return b.minPrice - a.minPrice;
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  return {
    rows: filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE),
    total: filtered.length,
    page,
    totalPages,
    counts,
    variantTotal: rows.reduce((s, r) => s + r.variantCount, 0),
    categories: categories.map((c) => ({
      id: c.id,
      label: c.parent_id ? `${categories.find((p) => p.id === c.parent_id)?.name ?? ""} › ${c.name}` : c.name,
    })),
  };
}

// ---------- Form thêm / sửa ----------

export type ProductFormData = {
  id: string | null;
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  material: string;
  dimensions: string;
  bulb: string;
  extraSpecs: { label: string; value: string }[];
  careInstructions: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: Enums<"product_status">;
  isFeatured: boolean;
  badge: Enums<"product_badge">;
  lowStockThreshold: number | null;
  materialTags: string[];
  colorTags: string[];
  spaces: string[];
  seoDescription: string;
  options: { name: string; values: { value: string; hex: string | null }[] }[];
  variants: { id: string | null; sku: string; price: number; stock: number; isActive: boolean; optionValues: Record<string, string> }[];
  images: { path: string }[];
  createdAt: string | null;
  updatedAt: string | null;
};

function toStringRecord(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"));
}

export async function getProductForm(id: string): Promise<ProductFormData | null> {
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("products")
    .select(
      "*, product_options(name, sort_order, product_option_values(value, hex, sort_order)), product_variants(id, sku, price, stock, is_active, option_values, sort_order), product_images(storage_path, is_cover, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return null;

  const specs = Array.isArray(p.extra_specs)
    ? p.extra_specs.flatMap((s) =>
        s && typeof s === "object" && !Array.isArray(s) && typeof s.label === "string" && typeof s.value === "string"
          ? [{ label: s.label, value: s.value }]
          : [],
      )
    : [];

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.category_id ?? "",
    description: p.description ?? "",
    material: p.material ?? "",
    dimensions: p.dimensions ?? "",
    bulb: p.bulb ?? "",
    extraSpecs: specs,
    careInstructions: p.care_instructions ?? "",
    basePrice: p.base_price,
    compareAtPrice: p.compare_at_price,
    status: p.status,
    isFeatured: p.is_featured,
    badge: p.badge,
    lowStockThreshold: p.low_stock_threshold,
    materialTags: p.material_tags,
    colorTags: p.color_tags,
    spaces: p.spaces,
    seoDescription: p.seo_description ?? "",
    options: [...p.product_options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({
        name: o.name,
        values: [...o.product_option_values].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ value: v.value, hex: v.hex })),
      })),
    variants: [...p.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, sku: v.sku, price: v.price, stock: v.stock, isActive: v.is_active, optionValues: toStringRecord(v.option_values) })),
    images: [...p.product_images]
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
      .map((img) => ({ path: img.storage_path })),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function getCategoryOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, parent_id, sort_order").order("sort_order");
  const categories = data ?? [];
  // Danh mục cha trước, con ngay sau cha: "Đèn › Đèn bàn"
  return categories
    .filter((c) => !c.parent_id)
    .flatMap((parent) => {
      const children = categories.filter((c) => c.parent_id === parent.id);
      return [{ id: parent.id, label: parent.name }, ...children.map((c) => ({ id: c.id, label: `${parent.name} › ${c.name}` }))];
    });
}
