const vndFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 1890000 → "1.890.000₫" */
export function formatVND(amount: number | bigint | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return `${vndFormatter.format(amount)}₫`;
}

const DATE_PARTS = { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" } as const;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", DATE_PARTS);
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { ...DATE_PARTS, hour: "2-digit", minute: "2-digit", hour12: false });

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "2026-10-29T03:00:00Z" → "29/10/2026" (giờ Việt Nam) */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return dateFormatter.format(toDate(value));
}

/** → "10:00 29/10/2026" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(toDate(value)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}
