import "server-only";

import { artKindFor, tintFor, type ArtKind } from "@/components/shop/ProductArt";
import { effectiveQuoteStatus, quoteDiscount } from "@/lib/admin/quote-filters";
import { productImageUrl } from "@/lib/shop/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/types/database";

// Báo giá công khai /bg/<token>: khách không đăng nhập nên đọc bằng service role, chỉ theo đúng token.

const TOKEN = /^[0-9a-f]{32}$/;

export function isQuoteToken(token: string): boolean {
  return TOKEN.test(token);
}

export type PublicQuote = {
  code: string;
  /** Trạng thái thực tế (đã tính hết hạn) */
  status: Enums<"quote_status">;
  customerName: string;
  customerAddress: string | null;
  message: string | null;
  terms: string[];
  discountPercent: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  validUntil: string | null;
  createdAt: string;
  acceptedAt: string | null;
  orderCode: string | null;
  author: string;
  items: {
    id: string;
    name: string;
    variant: string | null;
    qty: number;
    unitPrice: number;
    coverUrl: string | null;
    tint: string;
    art: ArtKind;
  }[];
};

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!isQuoteToken(token)) return null;
  const supabase = createAdminClient();
  const { data: q, error } = await supabase
    .from("quotes")
    .select(
      "*, customer:customers(name, address), order:orders!quotes_order_id_fkey(code), quote_items(id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order, variant:product_variants(product_id, product:products(category:categories(slug))))",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!q) return null;

  const productIds = [...new Set(q.quote_items.map((i) => i.variant?.product_id).filter((id): id is string => Boolean(id)))];
  const [{ data: covers }, { data: author }] = await Promise.all([
    productIds.length
      ? supabase.from("product_images").select("product_id, storage_path").eq("is_cover", true).in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; storage_path: string }[] }),
    q.created_by
      ? supabase.from("profiles").select("full_name").eq("id", q.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const coverByProduct = new Map((covers ?? []).map((c) => [c.product_id, c.storage_path]));
  const percent = Number(q.discount_percent);

  return {
    code: q.code,
    status: effectiveQuoteStatus(q.status, q.valid_until),
    customerName: q.customer?.name ?? "Quý khách",
    customerAddress: q.customer?.address ?? null,
    message: q.message,
    // Mỗi dòng một ý; bỏ ký hiệu đầu dòng vì trang tự vẽ danh sách
    terms: (q.terms ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*[•\-*·]\s*/, "").trim())
      .filter(Boolean),
    discountPercent: percent,
    subtotal: q.subtotal,
    discount: quoteDiscount(q.subtotal, percent),
    shippingFee: q.shipping_fee,
    total: q.total,
    validUntil: q.valid_until,
    createdAt: q.created_at,
    acceptedAt: q.accepted_at,
    orderCode: q.order?.code ?? null,
    author: author?.full_name ?? "Admin",
    items: [...q.quote_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => {
        const productId = i.variant?.product_id ?? null;
        const cover = productId ? coverByProduct.get(productId) : undefined;
        return {
          id: i.id,
          name: i.name_snapshot,
          variant: i.variant_snapshot,
          qty: i.qty,
          unitPrice: i.unit_price,
          coverUrl: cover ? productImageUrl(cover) : null,
          tint: tintFor(productId ?? i.id),
          art: artKindFor(i.variant?.product?.category?.slug ?? null, i.name_snapshot),
        };
      }),
  };
}

/** Đếm lượt khách mở link (lần đầu: "đã gửi" → "khách đã xem") */
export async function recordQuoteView(token: string): Promise<void> {
  if (!isQuoteToken(token)) return;
  const { error } = await createAdminClient().rpc("public_view_quote", { p_token: token });
  if (error) console.error("Không ghi được lượt xem báo giá:", error.message);
}
