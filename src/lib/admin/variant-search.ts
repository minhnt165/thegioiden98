import { foldVietnamese } from "@/lib/shop/filters";
import type { VariantOption } from "./orders";

/** Tìm phân loại theo tên SP + phân loại + SKU, không dấu, mọi từ phải khớp (cùng luật ô thêm sản phẩm của đơn) */
export function searchVariants(variants: VariantOption[], query: string, limit = 8): VariantOption[] {
  const words = foldVietnamese(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return variants
    .filter((v) => {
      const text = foldVietnamese(`${v.productName} ${v.label ?? ""} ${v.sku}`);
      return words.every((w) => text.includes(w));
    })
    .slice(0, limit);
}
