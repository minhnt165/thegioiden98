import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Enums, Json } from "@/types/database";

// Dữ liệu cửa hàng đọc bằng client ẩn danh (RLS chỉ trả sản phẩm đang bán, phân loại đang bật).
// Mọi hàm đọc đều "use cache" theo tag "products" / "categories" để admin làm mới khi sửa.

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  description: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  material: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  /** Các phân loại có giá khác nhau → hiển thị "Từ …" */
  priceVaries: boolean;
  stock: number;
  badge: Enums<"product_badge">;
  isFeatured: boolean;
  createdAt: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  materialTags: string[];
  colorTags: string[];
  spaces: string[];
  coverPath: string | null;
};

export type ProductOption = {
  id: string;
  name: string;
  values: { id: string; value: string; hex: string | null }[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  price: number;
  stock: number;
  optionValues: Record<string, string>;
};

export type ProductDetail = CatalogProduct & {
  description: string | null;
  dimensions: string | null;
  bulb: string | null;
  extraSpecs: { label: string; value: string }[];
  careInstructions: string | null;
  seoDescription: string | null;
  category: Category | null;
  parentCategory: Category | null;
  options: ProductOption[];
  variants: ProductVariant[];
  images: { path: string; isCover: boolean }[];
};

const BADGE_LABEL: Record<Enums<"product_badge">, string | null> = {
  none: null,
  bestseller: "Bán chạy",
  new: "Mới",
};

export function badgeLabel(badge: Enums<"product_badge">): string | null {
  return BADGE_LABEL[badge];
}

/** URL công khai của ảnh trong bucket "products" */
export function productImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;
}

function toStringRecord(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"));
}

function toSpecs(value: Json): { label: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { label, value: v } = item;
    return typeof label === "string" && typeof v === "string" && label && v ? [{ label, value: v }] : [];
  });
}

const CATALOG_SELECT = `
  id, name, slug, material, base_price, compare_at_price, badge, is_featured, created_at,
  material_tags, color_tags, spaces,
  category:categories(id, slug, name),
  product_variants(price, stock),
  product_images(storage_path, is_cover, sort_order)
` as const;

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  material: string | null;
  base_price: number;
  compare_at_price: number | null;
  badge: Enums<"product_badge">;
  is_featured: boolean;
  created_at: string;
  material_tags: string[];
  color_tags: string[];
  spaces: string[];
  category: { id: string; slug: string; name: string } | null;
  product_variants: { price: number; stock: number }[];
  product_images: { storage_path: string; is_cover: boolean; sort_order: number }[];
};

function pickCover(images: CatalogRow["product_images"]): string | null {
  if (!images.length) return null;
  const sorted = [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  return sorted[0].storage_path;
}

function toCatalogProduct(row: CatalogRow): CatalogProduct {
  const prices = row.product_variants.map((v) => v.price);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    material: row.material,
    basePrice: row.base_price,
    compareAtPrice: row.compare_at_price,
    priceVaries: prices.length > 1 && Math.min(...prices) !== Math.max(...prices),
    stock: row.product_variants.reduce((sum, v) => sum + v.stock, 0),
    badge: row.badge,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    categoryId: row.category?.id ?? null,
    categorySlug: row.category?.slug ?? null,
    categoryName: row.category?.name ?? null,
    materialTags: row.material_tags,
    colorTags: row.color_tags,
    spaces: row.spaces,
    coverPath: pickCover(row.product_images),
  };
}

async function fetchCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");

  const { data, error } = await createPublicClient().from("categories").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    sortOrder: c.sort_order,
    description: (c as { description?: string | null }).description ?? null,
  }));
}

async function fetchCatalog(): Promise<CatalogProduct[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const { data, error } = await createPublicClient().from("products").select(CATALOG_SELECT);
  if (error) throw new Error(error.message);
  return (data as unknown as CatalogRow[]).map(toCatalogProduct);
}

async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${slug}`);

  const { data, error } = await createPublicClient()
    .from("products")
    .select(
      `${CATALOG_SELECT},
      description, dimensions, bulb, extra_specs, care_instructions, seo_description,
      product_options(id, name, sort_order, product_option_values(id, value, hex, sort_order)),
      variants:product_variants(id, sku, price, stock, option_values, sort_order)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as CatalogRow & {
    description: string | null;
    dimensions: string | null;
    bulb: string | null;
    extra_specs: Json;
    care_instructions: string | null;
    seo_description: string | null;
    product_options: {
      id: string;
      name: string;
      sort_order: number;
      product_option_values: { id: string; value: string; hex: string | null; sort_order: number }[];
    }[];
    variants: { id: string; sku: string; price: number; stock: number; option_values: Json; sort_order: number }[];
  };

  const categories = await fetchCategories();
  const category = categories.find((c) => c.id === row.category?.id) ?? null;
  const parentCategory = category?.parentId ? (categories.find((c) => c.id === category.parentId) ?? null) : null;

  return {
    ...toCatalogProduct(row),
    description: row.description,
    dimensions: row.dimensions,
    bulb: row.bulb,
    extraSpecs: toSpecs(row.extra_specs),
    careInstructions: row.care_instructions,
    seoDescription: row.seo_description,
    category,
    parentCategory,
    options: [...row.product_options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({
        id: o.id,
        name: o.name,
        values: [...o.product_option_values]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, value: v.value, hex: v.hex })),
      })),
    variants: [...row.variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, sku: v.sku, price: v.price, stock: v.stock, optionValues: toStringRecord(v.option_values) })),
    images: [...row.product_images]
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
      .map((img) => ({ path: img.storage_path, isCover: img.is_cover })),
  };
}

// --- API công khai: lỗi kết nối không làm sập trang, chỉ trả rỗng và ghi log ---

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await fetchCategories();
  } catch (error) {
    console.error("Không đọc được danh mục:", error);
    return [];
  }
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await fetchCatalog();
  } catch (error) {
    console.error("Không đọc được sản phẩm:", error);
    return [];
  }
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  if (!isSupabaseConfigured()) return null;
  return fetchProduct(slug);
}

/** Danh mục + toàn bộ danh mục con (dùng để lọc /danh-muc/den gồm cả đèn bàn, đèn sàn…) */
export function categoryWithDescendants(categories: Category[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

/** "Hợp với món này": ưu tiên món khác danh mục nhưng cùng không gian, rồi tới cùng danh mục */
export function relatedProducts(catalog: CatalogProduct[], product: CatalogProduct, limit = 4): CatalogProduct[] {
  const others = catalog.filter((p) => p.id !== product.id);
  const score = (p: CatalogProduct) => {
    const sharedSpaces = p.spaces.filter((s) => product.spaces.includes(s)).length;
    const otherCategory = p.categoryId !== product.categoryId ? 1 : 0;
    return sharedSpaces * 2 + otherCategory + (p.isFeatured ? 0.5 : 0);
  };
  return others.sort((a, b) => score(b) - score(a)).slice(0, limit);
}
