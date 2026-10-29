import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { CalendarClock, CircleCheck } from "lucide-react";
import { SiZalo } from "react-icons/si";
import { LogoMark } from "@/components/brand/Logo";
import { AcceptQuoteButton } from "@/components/shop/AcceptQuoteButton";
import { ProductArt } from "@/components/shop/ProductArt";
import { getCurrentUser } from "@/lib/admin/auth";
import { formatDay } from "@/lib/admin/quote-filters";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { zaloLink } from "@/lib/shop/contact";
import { getPublicQuote, recordQuoteView } from "@/lib/shop/quote";
import { getShopSettings } from "@/lib/shop/settings";

// Trang khách xem báo giá (mockup design/QuoteCustomer.html). Link chỉ dành cho một khách nên không cho index.
export const metadata: Metadata = { title: "Báo giá", robots: { index: false, follow: false } };

function Row({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={className}>{children}</span>
    </div>
  );
}

async function QuoteContent({ params }: { params: PageProps<"/bg/[token]">["params"] }) {
  const { token } = await params;
  const [quote, user, shop] = await Promise.all([getPublicQuote(token), getCurrentUser(), getShopSettings()]);
  if (!quote) notFound();

  // Shop bấm "Xem như khách": không tính lượt xem, không cho bấm đồng ý; báo giá nháp chỉ shop xem được
  const preview = user?.role === "admin";
  if (quote.status === "draft" && !preview) notFound();
  if (!preview) after(() => recordQuoteView(token));

  const zalo = zaloLink(shop.zaloPhone);
  const open = quote.status === "sent" || quote.status === "viewed" || quote.status === "draft";
  const agreed = quote.status === "accepted" || quote.status === "ordered";

  return (
    <div className="mx-auto flex w-full max-w-120 flex-1 flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <Link href="/" aria-label="Thế Giới Đèn 98" className="inline-flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="flex flex-col font-serif text-[15px] leading-none tracking-[-0.02em]">
            <span className="font-medium">Thế Giới Đèn</span>
            <span className="italic text-terracotta">98</span>
          </span>
        </Link>
        <span className="text-[12px] text-muted">Báo giá · {quote.code}</span>
      </header>

      {preview && (
        <p className="bg-status-blue-bg px-5 py-2.5 text-[12px] text-status-blue">
          Bản xem của shop{quote.status === "draft" ? " — báo giá chưa gửi khách" : ""}. Lượt xem này không được tính.
        </p>
      )}

      <section className="flex flex-col gap-2.5 px-5 pb-5 pt-7">
        <h1 className="font-serif text-[34px] font-light leading-[1.05] tracking-[-0.02em]">
          Báo giá cho <em className="font-normal text-terracotta">{quote.customerName}</em>
        </h1>
        {quote.message && <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted">{quote.message}</p>}
        {quote.validUntil && open && (
          <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-status-amber-bg px-2.5 py-1.5 text-[12px] text-status-amber">
            <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.8} />
            Giữ giá đến {formatDay(quote.validUntil)}
          </span>
        )}
      </section>

      <section aria-label="Sản phẩm" className="mx-5 overflow-hidden rounded-[20px] border border-line bg-white">
        <ul>
          {quote.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5">
              <span className={`relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${item.tint}`}>
                {item.coverUrl ? (
                  <Image src={item.coverUrl} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <ProductArt kind={item.art} className="h-10 w-auto" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-medium">{item.name}</span>
                <span className="text-[12px] text-muted">{[item.variant, `×${item.qty}`].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="whitespace-nowrap text-[14px] font-medium">{formatVND(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 bg-cream px-4 py-3.5 text-[13px]">
          <Row label="Tạm tính">{formatVND(quote.subtotal)}</Row>
          {quote.discount > 0 && (
            <Row label={`Giảm giá ${quote.discountPercent.toLocaleString("vi-VN")}%`} className="text-status-green">
              −{formatVND(quote.discount)}
            </Row>
          )}
          <Row label="Giao hàng">{quote.shippingFee ? formatVND(quote.shippingFee) : "Miễn phí"}</Row>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
            <span className="text-[14px] font-medium">Tổng</span>
            <span className="text-[22px] font-medium">{formatVND(quote.total)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5 p-5">
        {agreed ? (
          <div role="status" className="flex flex-col gap-1.5 rounded-2xl bg-status-green-bg px-4 py-3.5 text-[14px] text-status-green">
            <span className="flex items-center gap-2 font-medium">
              <CircleCheck aria-hidden className="size-4.5" strokeWidth={1.8} />
              {quote.orderCode ? `Đã đặt hàng — mã đơn ${quote.orderCode}` : "Bạn đã đồng ý báo giá"}
            </span>
            <span className="text-[13px] leading-relaxed">
              {quote.acceptedAt && `Ghi nhận lúc ${formatDateTime(quote.acceptedAt)}. `}Shop sẽ gọi xác nhận địa chỉ và thời gian giao.
            </span>
          </div>
        ) : open ? (
          <AcceptQuoteButton token={token} preview={preview} />
        ) : (
          <p role="status" className="rounded-2xl bg-status-amber-bg px-4 py-3.5 text-[14px] leading-relaxed text-status-amber">
            {quote.status === "expired"
              ? `Báo giá đã hết hạn${quote.validUntil ? ` từ ${formatDay(quote.validUntil)}` : ""}. Nhắn Zalo để shop gửi lại giá mới nhé.`
              : "Báo giá này đã đóng. Nhắn Zalo nếu bạn cần shop báo giá lại."}
          </p>
        )}
        {zalo && (
          <a
            href={zalo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12.5 items-center justify-center gap-2 rounded-full bg-zalo text-[15px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <SiZalo aria-hidden className="size-6" />
            Hỏi thêm qua Zalo
          </a>
        )}
        {open && (
          <span className="text-center text-[12px] leading-normal text-muted">
            Bấm “Đồng ý” shop sẽ gọi xác nhận địa chỉ và thời gian giao. Chưa cần thanh toán.
          </span>
        )}
      </section>

      {(quote.customerAddress || quote.terms.length > 0) && (
        <section className="mx-5 flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <h2 className="text-[13px] font-medium">Giao hàng & thanh toán</h2>
          <ul className="list-disc pl-4 text-[13px] leading-[1.7] text-muted">
            {quote.customerAddress && <li>Giao đến: {quote.customerAddress}</li>}
            {quote.terms.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-5 mt-4 flex flex-col gap-1.5 rounded-2xl bg-ink p-4 text-cream">
        <span className="font-serif text-[18px]">{shop.shopName}</span>
        <span className="text-[12px] opacity-80">
          Showroom: {shop.address} · {shop.openingHours}
        </span>
        <span className="text-[12px] opacity-80">
          {[shop.zaloPhone && `Zalo: ${shop.zaloPhone}`, `Người lập: ${quote.author}`, formatDate(quote.createdAt)].filter(Boolean).join(" · ")}
        </span>
      </section>

      <footer className="p-5 text-center text-[11px] text-muted">
        Báo giá {quote.code}
        {quote.validUntil && ` · Có hiệu lực đến ${formatDay(quote.validUntil)}`} · Mỗi link chỉ dành cho một khách.
      </footer>
    </div>
  );
}

export default function QuotePage({ params }: PageProps<"/bg/[token]">) {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-cream">
      <Suspense fallback={<p className="p-8 text-center text-[14px] text-muted">Đang mở báo giá…</p>}>
        <QuoteContent params={params} />
      </Suspense>
    </main>
  );
}
