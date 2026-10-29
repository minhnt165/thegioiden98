import type { Enums } from "@/types/database";

// Bộ lọc danh sách đơn admin + quy tắc chuyển trạng thái: dùng được ở cả server và client

type OrderStatus = Enums<"order_status">;

export const ORDER_TABS = [
  { value: "tat-ca", label: "Tất cả", status: null },
  { value: "cho-xac-nhan", label: "Chờ xác nhận", status: "pending" },
  { value: "cho-dong-goi", label: "Chờ đóng gói", status: "packing" },
  { value: "dang-giao", label: "Đang giao", status: "shipping" },
  { value: "hoan-tat", label: "Hoàn tất", status: "done" },
  { value: "da-huy", label: "Đã hủy", status: "cancelled" },
  { value: "doi-tra", label: "Đổi trả", status: "returned" },
] as const satisfies readonly { value: string; label: string; status: OrderStatus | null }[];

export type OrderTab = (typeof ORDER_TABS)[number]["value"];

export const CHANNEL_FILTERS = [
  { value: "", label: "Mọi kênh" },
  { value: "zalo", label: "Zalo" },
  { value: "messenger", label: "Messenger" },
  { value: "showroom", label: "Showroom" },
] as const;

export const PAYMENT_FILTERS = [
  { value: "", label: "Mọi thanh toán" },
  { value: "cod", label: "COD" },
  { value: "bank_transfer", label: "Chuyển khoản" },
  { value: "cash", label: "Tiền mặt" },
] as const;

export const ORDER_PAGE_SIZE = 20;

export type AdminOrderQuery = {
  tab: OrderTab;
  q: string;
  channel: (typeof CHANNEL_FILTERS)[number]["value"];
  payment: (typeof PAYMENT_FILTERS)[number]["value"];
  /** "2026-10-29" theo giờ Việt Nam, rỗng = không giới hạn */
  from: string;
  to: string;
  page: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseAdminOrderQuery(params: Record<string, string | string[] | undefined>): AdminOrderQuery {
  const tab = one(params.tab);
  const channel = one(params.kenh);
  const payment = one(params["thanh-toan"]);
  const from = one(params.tu);
  const to = one(params.den);
  const page = Number.parseInt(one(params.trang), 10);
  return {
    tab: ORDER_TABS.find((t) => t.value === tab)?.value ?? "tat-ca",
    q: one(params.q).trim().slice(0, 80),
    channel: CHANNEL_FILTERS.find((c) => c.value === channel)?.value ?? "",
    payment: PAYMENT_FILTERS.find((p) => p.value === payment)?.value ?? "",
    from: DAY.test(from) ? from : "",
    to: DAY.test(to) ? to : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function adminOrderSearch(query: AdminOrderQuery, patch: Partial<AdminOrderQuery> = {}): string {
  const next = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (next.tab !== "tat-ca") sp.set("tab", next.tab);
  if (next.q) sp.set("q", next.q);
  if (next.channel) sp.set("kenh", next.channel);
  if (next.payment) sp.set("thanh-toan", next.payment);
  if (next.from) sp.set("tu", next.from);
  if (next.to) sp.set("den", next.to);
  if (next.page > 1) sp.set("trang", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- Chuyển trạng thái (khớp hàm admin_set_order_status trong migration 006) ----------

export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["packing", "cancelled"],
  packing: ["shipping", "cancelled"],
  shipping: ["done", "returned", "cancelled"],
  done: ["returned"],
  cancelled: [],
  returned: [],
};

/** Nút chuyển sang trạng thái đích; done ghép thành "Đã xác nhận 2 đơn". "Hủy" và "trả hàng" cộng lại kho nên cần xác nhận. */
export const STATUS_ACTION: Record<OrderStatus, { label: string; done: string; confirm?: string }> = {
  pending: { label: "", done: "" },
  packing: { label: "Xác nhận đơn", done: "Đã xác nhận" },
  shipping: { label: "Đã gói, giao đi", done: "Đã giao đi" },
  done: { label: "Đã giao xong", done: "Đã hoàn tất" },
  cancelled: { label: "Hủy đơn", done: "Đã hủy", confirm: "Hủy đơn này? Số lượng trong đơn sẽ được cộng lại vào kho." },
  returned: { label: "Khách trả hàng", done: "Đã ghi nhận trả hàng cho", confirm: "Ghi nhận khách trả hàng? Số lượng trong đơn sẽ được cộng lại vào kho." },
};
