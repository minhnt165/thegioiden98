import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/PrintButton";
import { getCurrentUser } from "@/lib/admin/auth";
import { formatDay, quoteDiscount, quoteUrl } from "@/lib/admin/quote-filters";
import { getQuoteForm } from "@/lib/admin/quotes";
import { formatDate, formatVND } from "@/lib/format";
import { getShopSettings } from "@/lib/shop/settings";

export const metadata: Metadata = { title: "In báo giá" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function QuoteSheet({ searchParams }: { searchParams: PageProps<"/admin/in-bao-gia">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/dang-nhap");
  if (user.role !== "admin") return <p className="p-8 text-[14px]">Tài khoản chưa có quyền quản trị.</p>;

  const { id } = await searchParams;
  const quoteId = Array.isArray(id) ? id[0] : id;
  const [quote, shop] = await Promise.all([quoteId && UUID.test(quoteId) ? getQuoteForm(quoteId) : null, getShopSettings()]);
  if (!quote || !quote.token) return <p className="p-8 text-[14px]">Không tìm thấy báo giá.</p>;

  const subtotal = quote.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discount = quoteDiscount(subtotal, quote.discountPercent);
  const terms = quote.terms
    .split("\n")
    .map((line) => line.replace(/^\s*[•\-*·]\s*/, "").trim())
    .filter(Boolean);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-3 print:hidden">
        <span className="text-[14px]">Báo giá {quote.code} · khổ A4 — chọn “Lưu dưới dạng PDF” trong hộp thoại in</span>
        <PrintButton label="In / lưu PDF" />
      </div>
      <div className="flex justify-center py-6 print:block print:p-0">
        <article className="flex w-full max-w-[210mm] flex-col gap-5 bg-white p-[14mm] text-[12px] text-ink shadow-sm print:max-w-none print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b border-ink pb-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-serif text-[24px] leading-none">{shop.shopName}</span>
              <span>Showroom: {shop.address} · {shop.openingHours}</span>
              {shop.zaloPhone && <span>ĐT / Zalo: {shop.zaloPhone}</span>}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <span className="text-[11px] uppercase tracking-[0.12em]">Báo giá</span>
              <span className="text-[20px] font-semibold">{quote.code}</span>
              <span>Ngày lập: {formatDate(quote.progress?.createdAt)}</span>
              <span>Hiệu lực đến: {formatDay(quote.validUntil)}</span>
            </div>
          </header>

          <section className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Kính gửi</span>
            <span className="text-[14px] font-semibold">{quote.customer.name}</span>
            {quote.customer.phone && <span>{quote.customer.phone}</span>}
            {quote.customer.address && <span>{quote.customer.address}</span>}
          </section>

          {quote.message && <p className="whitespace-pre-line leading-relaxed">{quote.message}</p>}

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-ink text-left">
                <th className="w-8 py-1.5 pr-2 font-semibold">#</th>
                <th className="py-1.5 pr-2 font-semibold">Sản phẩm</th>
                <th className="px-2 py-1.5 text-right font-semibold">SL</th>
                <th className="px-2 py-1.5 text-right font-semibold">Đơn giá</th>
                <th className="py-1.5 pl-2 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-1.5 pr-2 align-top">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {item.name}
                    {item.variant && <span className="block text-[11px] text-muted">{item.variant}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{item.qty}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{formatVND(item.unitPrice)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right">{formatVND(item.unitPrice * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto flex w-72 flex-col gap-1">
            <div className="flex justify-between">
              <span>Tạm tính</span>
              <span>{formatVND(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span>Giảm giá {quote.discountPercent.toLocaleString("vi-VN")}%</span>
                <span>−{formatVND(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Phí giao hàng</span>
              <span>{quote.shippingFee ? formatVND(quote.shippingFee) : "Miễn phí"}</span>
            </div>
            <div className="flex justify-between border-t border-ink pt-1 text-[15px] font-semibold">
              <span>Tổng báo giá</span>
              <span>{formatVND(subtotal - discount + quote.shippingFee)}</span>
            </div>
          </div>

          {terms.length > 0 && (
            <section className="flex flex-col gap-1">
              <span className="font-semibold">Điều khoản</span>
              <ul className="list-disc pl-4 leading-relaxed">
                {terms.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3 text-[11px] text-muted">
            <span>Xem báo giá online và bấm “Đồng ý” để đặt hàng: {quoteUrl(quote.token)}</span>
            <span>Người lập: {quote.progress?.createdBy ?? "Admin"}</span>
          </footer>
        </article>
      </div>
    </>
  );
}

/** Trang in / lưu PDF một báo giá: /admin/in-bao-gia?id=<id> */
export default function QuotePrintPage({ searchParams }: PageProps<"/admin/in-bao-gia">) {
  return (
    <main className="min-h-full flex-1 bg-cream print:bg-white">
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      <Suspense fallback={<p className="p-8 text-[14px] text-muted">Đang chuẩn bị báo giá…</p>}>
        <QuoteSheet searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
