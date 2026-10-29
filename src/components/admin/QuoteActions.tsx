"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { convertQuoteToOrder, extendQuote, markQuoteSent, rejectQuote } from "@/app/admin/(panel)/bao-gia/actions";
import { buildQuoteReminder, formatDay, quoteUrl } from "@/lib/admin/quote-filters";
import { zaloLink } from "@/lib/shop/contact";
import type { Enums } from "@/types/database";
import { BTN_PRIMARY, BTN_SECONDARY } from "./ui";

export type QuoteRef = {
  id: string;
  code: string;
  status: Enums<"quote_status">;
  token: string;
  customerName: string;
  customerPhone: string | null;
  validUntil: string | null;
  orderId: string | null;
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Chép tin nhắc khách rồi mở Zalo của khách (Zalo không nhận nội dung qua link). Không có SĐT thì chỉ chép. */
async function remind(quote: QuoteRef): Promise<string> {
  const zalo = quote.customerPhone ? zaloLink(quote.customerPhone) : null;
  // Bắt đầu chép khi trang còn focus, rồi mở Zalo ngay trong lúc bấm để trình duyệt không chặn popup
  const copying = copyText(
    buildQuoteReminder({ code: quote.code, customerName: quote.customerName, url: quoteUrl(quote.token), validUntil: quote.validUntil }),
  );
  if (zalo) window.open(zalo, "_blank", "noopener,noreferrer");
  if (!(await copying)) return "Trình duyệt chặn chép tự động — mở báo giá để chép link.";
  return zalo ? "Đã chép tin nhắc — dán vào Zalo của khách." : "Đã chép tin nhắc — gửi cho khách qua kênh đang trò chuyện.";
}

const ROW_BTN = "inline-flex h-8.5 items-center rounded-lg border px-3 text-[13px] disabled:opacity-50";
const ROW_SECONDARY = `${ROW_BTN} border-line bg-white hover:border-ink`;
const ROW_PRIMARY = `${ROW_BTN} border-ink bg-ink text-cream hover:text-glow`;

/** Nút thao tác chính ở mỗi dòng danh sách báo giá (theo mockup AdminQuotes) */
export function QuoteRowAction({ quote }: { quote: QuoteRef }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const edit = `/admin/bao-gia/${quote.id}`;

  function run(fn: () => Promise<{ ok: boolean; text: string }>) {
    setMessage(null);
    startTransition(async () => setMessage(await fn()));
  }

  let button: React.ReactNode;
  switch (quote.status) {
    case "draft":
      button = (
        <Link href={edit} className={ROW_SECONDARY}>
          Tiếp tục soạn
        </Link>
      );
      break;
    case "sent":
    case "viewed":
      button = (
        <button type="button" onClick={() => run(async () => ({ ok: true, text: await remind(quote) }))} className={ROW_SECONDARY}>
          Nhắc khách
        </button>
      );
      break;
    case "accepted":
      button = (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Tạo đơn chờ xác nhận từ ${quote.code}? Kho được trừ ngay.`)) return;
            run(async () => {
              const result = await convertQuoteToOrder(quote.id);
              if (!result.ok) return { ok: false, text: result.error };
              router.push(`/admin/don-hang/${result.data.id}`);
              return { ok: true, text: `Đã tạo đơn ${result.data.code}.` };
            });
          }}
          className={ROW_PRIMARY}
        >
          {pending ? "Đang tạo…" : "Tạo đơn"}
        </button>
      );
      break;
    case "ordered":
      button = quote.orderId ? (
        <Link href={`/admin/don-hang/${quote.orderId}`} className={ROW_SECONDARY}>
          Xem đơn
        </Link>
      ) : null;
      break;
    case "expired":
      button = (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await extendQuote(quote.id);
              return result.ok ? { ok: true, text: `Giữ giá đến ${formatDay(result.data.validUntil)}.` } : { ok: false, text: result.error };
            })
          }
          className={ROW_SECONDARY}
        >
          Gia hạn
        </button>
      );
      break;
    default:
      button = (
        <Link href={edit} className={ROW_SECONDARY}>
          Xem
        </Link>
      );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {button}
      {message && (
        <span role={message.ok ? "status" : "alert"} className={`max-w-56 whitespace-normal text-right text-[11px] ${message.ok ? "text-muted" : "text-status-red"}`}>
          {message.text}
        </span>
      )}
    </span>
  );
}

/**
 * Thao tác ở thẻ "Tiến trình" trang báo giá. dirty: form đang có thay đổi chưa lưu → chưa cho tạo đơn
 * (đơn lấy theo nội dung đã lưu).
 */
export function QuoteProgressActions({ quote, dirty }: { quote: QuoteRef; dirty: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; text: string } | null>) {
    setMessage(null);
    startTransition(async () => setMessage(await fn()));
  }

  const canConvert = quote.status !== "ordered" && quote.status !== "rejected";
  const canRemind = quote.status === "sent" || quote.status === "viewed";
  const canReject = ["sent", "viewed", "accepted", "expired"].includes(quote.status);

  if (quote.status === "ordered" && quote.orderId) {
    return (
      <Link href={`/admin/don-hang/${quote.orderId}`} className={BTN_PRIMARY}>
        Xem đơn hàng
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {asking ? (
        <div className="flex flex-col gap-2.5 rounded-xl bg-cream p-3">
          <p className="text-[13px] leading-relaxed">Tạo đơn chờ xác nhận theo báo giá này? Kho được trừ ngay, đơn thanh toán COD (sửa được ở trang đơn).</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await convertQuoteToOrder(quote.id);
                  if (!result.ok) return { ok: false, text: result.error };
                  router.push(`/admin/don-hang/${result.data.id}`);
                  return { ok: true, text: `Đã tạo đơn ${result.data.code}.` };
                })
              }
              className={BTN_PRIMARY}
            >
              {pending ? "Đang tạo…" : "Tạo đơn"}
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking(false)} className={BTN_SECONDARY}>
              Thôi
            </button>
          </div>
        </div>
      ) : (
        canConvert && (
          <button type="button" disabled={dirty || pending} onClick={() => setAsking(true)} className={`${BTN_PRIMARY} h-11`}>
            Chuyển thành đơn hàng
          </button>
        )
      )}
      {dirty && canConvert && <span className="text-[12px] text-muted">Lưu thay đổi trước khi tạo đơn.</span>}
      {canRemind && (
        <button type="button" onClick={() => run(async () => ({ ok: true, text: await remind(quote) }))} className={`${BTN_SECONDARY} h-10 text-[13px] font-normal`}>
          Nhắc khách qua Zalo
        </button>
      )}
      {quote.status === "expired" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await extendQuote(quote.id);
              return result.ok ? { ok: true, text: `Đã gia hạn đến ${formatDay(result.data.validUntil)}.` } : { ok: false, text: result.error };
            })
          }
          className={`${BTN_SECONDARY} h-10 text-[13px] font-normal`}
        >
          Gia hạn báo giá
        </button>
      )}
      {canReject && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Đánh dấu khách không lấy ${quote.code}? Khách sẽ không bấm đồng ý được nữa.`)) return;
            run(async () => {
              const result = await rejectQuote(quote.id);
              return result.ok ? null : { ok: false, text: result.error };
            });
          }}
          className="self-center text-[12px] text-muted underline-offset-4 hover:text-status-red hover:underline disabled:opacity-50"
        >
          Khách không lấy
        </button>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[12px] ${message.ok ? "text-muted" : "text-status-red"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Ô link gửi khách + nút sao chép. Chép link của báo giá nháp coi như đã gửi. */
export function QuoteLinkBox({ quote }: { quote: QuoteRef }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const url = quoteUrl(quote.token);

  async function copy() {
    setMessage(null);
    if (!(await copyText(url))) return setMessage({ ok: false, text: "Trình duyệt chặn chép tự động — bôi đen link để chép." });
    if (quote.status === "draft") {
      const result = await markQuoteSent(quote.id);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      return setMessage({ ok: true, text: "Đã chép link — báo giá chuyển sang Đã gửi." });
    }
    setMessage({ ok: true, text: "Đã chép link." });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Đường dẫn báo giá"
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-cream px-3 text-[13px] outline-none"
        />
        <button type="button" onClick={copy} className="h-10 shrink-0 rounded-lg border border-line bg-white px-3 text-[13px] hover:border-ink">
          Sao chép
        </button>
      </div>
      <span role={message?.ok === false ? "alert" : "status"} className={`text-[12px] ${message?.ok === false ? "text-status-red" : "text-muted"}`}>
        {message?.text ?? "Khách mở link không cần đăng nhập; bấm “Đồng ý” là đơn tự tạo ở mục Đơn hàng."}
      </span>
    </div>
  );
}
