import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000").replace(/\/$/, "");

// Trang quản trị và link báo giá riêng của từng khách không cho máy tìm kiếm thu thập
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/bg/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
