import type { Enums } from "@/types/database";
import { CHANNEL_FILTERS } from "./order-filters";

// Bộ lọc danh sách báo giá + quy tắc trạng thái: dùng được ở cả server và client

type QuoteStatus = Enums<"quote_status">;

export const QUOTE_TABS = [
  { value: "tat-ca", label: "Tất cả", statuses: null },
  { value: "nhap", label: "Nháp", statuses: ["draft"] },
  { value: "da-gui", label: "Đã gửi", statuses: ["sent"] },
  { value: "da-xem", label: "Khách đã xem", statuses: ["viewed"] },
  { value: "da-chot", label: "Đã chốt", statuses: ["accepted", "ordered"] },
  { value: "het-han", label: "Hết hạn / từ chối", statuses: ["expired", "rejected"] },
] as const satisfies readonly { value: string; label: string; statuses: readonly QuoteStatus[] | null }[];

export type QuoteTab = (typeof QUOTE_TABS)[number]["value"];

export const QUOTE_PAGE_SIZE = 20;

export type AdminQuoteQuery = {
  tab: QuoteTab;
  q: string;
  channel: (typeof CHANNEL_FILTERS)[number]["value"];
  page: number;
};

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseAdminQuoteQuery(params: Record<string, string | string[] | undefined>): AdminQuoteQuery {
  const tab = one(params.tab);
  const channel = one(params.kenh);
  const page = Number.parseInt(one(params.trang), 10);
  return {
    tab: QUOTE_TABS.find((t) => t.value === tab)?.value ?? "tat-ca",
    q: one(params.q).trim().slice(0, 80),
    channel: CHANNEL_FILTERS.find((c) => c.value === channel)?.value ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function adminQuoteSearch(query: AdminQuoteQuery, patch: Partial<AdminQuoteQuery> = {}): string {
  const next = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (next.tab !== "tat-ca") sp.set("tab", next.tab);
  if (next.q) sp.set("q", next.q);
  if (next.channel) sp.set("kenh", next.channel);
  if (next.page > 1) sp.set("trang", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- Ngày & trạng thái ----------

/** Hôm nay theo giờ Việt Nam, dạng "2026-10-29" */
export function vnToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** "2026-10-29" + 7 → "2026-11-05" */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-05" → "05/11/2026" (cột date không có giờ nên không đổi múi giờ) */
export function formatDay(day: string | null): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Trạng thái thực tế: đã gửi / đã xem mà quá ngày hiệu lực thì là hết hạn (khớp view quote_list) */
export function effectiveQuoteStatus(status: QuoteStatus, validUntil: string | null, today = vnToday()): QuoteStatus {
  return (status === "sent" || status === "viewed") && validUntil !== null && validUntil < today ? "expired" : status;
}

/** Sửa được nội dung khi chưa chốt (khớp hàm admin_save_quote trong migration 007) */
export const QUOTE_EDITABLE: QuoteStatus[] = ["draft", "sent", "viewed", "expired"];

/** Giảm theo % tạm tính, làm tròn tới đồng (khớp cách tính trong SQL) */
export function quoteDiscount(subtotal: number, percent: number): number {
  return Math.round((subtotal * percent) / 100);
}

/** Thông báo sau khi lưu. Báo giá mới chuyển sang trang của nó nên thông báo đi qua ?xong=<key> */
export const QUOTE_SAVED_NOTICE = {
  luu: "Đã lưu báo giá.",
  "gui-zalo": "Đã lưu và chép lời nhắn kèm link — dán vào khung chat Zalo của khách (Zalo không mở thì bấm “Nhắc khách qua Zalo”).",
  "gui-chep": "Đã lưu và chép lời nhắn kèm link — dán vào cuộc trò chuyện với khách.",
  "gui-loi": "Đã lưu. Trình duyệt chặn chép tự động — chép link ở thẻ “Link gửi khách”.",
} as const;

export type QuoteSavedNotice = keyof typeof QUOTE_SAVED_NOTICE;

export function parseSavedNotice(value: string | string[] | undefined): QuoteSavedNotice | null {
  const v = one(value);
  return Object.hasOwn(QUOTE_SAVED_NOTICE, v) ? (v as QuoteSavedNotice) : null;
}

// ---------- Link & tin nhắn gửi khách ----------

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000";

export function quoteUrl(token: string): string {
  return `${SITE_URL.replace(/\/$/, "")}/bg/${token}`;
}

export function buildQuoteMessage(input: { code: string; customerName: string; message: string; url: string; validUntil: string }): string {
  const intro = input.message.trim() || `Shop gửi ${input.customerName} báo giá ${input.code} ạ.`;
  return `${intro}\n\nXem báo giá và bấm "Đồng ý" để đặt hàng (giữ giá đến ${formatDay(input.validUntil)}):\n${input.url}`;
}

export function buildQuoteReminder(input: { code: string; customerName: string; url: string; validUntil: string | null }): string {
  const until = input.validUntil ? ` vẫn giữ giá đến ${formatDay(input.validUntil)}` : "";
  return `Shop nhắc ${input.customerName} báo giá ${input.code}${until} ạ. Mình xem lại và bấm "Đồng ý" là shop lên đơn luôn:\n${input.url}`;
}
