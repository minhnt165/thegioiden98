import type { MetadataRoute } from "next";
import { getCatalog, getCategories } from "@/lib/shop/catalog";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000").replace(/\/$/, "");

// Trang cửa hàng cho máy tìm kiếm: trang chủ, tất cả sản phẩm, danh mục, sản phẩm đang bán
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, categories] = await Promise.all([getCatalog(), getCategories()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/san-pham`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${SITE_URL}/danh-muc/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...catalog.map((p) => ({ url: `${SITE_URL}/san-pham/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
