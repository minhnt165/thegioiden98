import { CHANNEL_FILTERS } from "./order-filters";

// Bộ lọc danh sách khách hàng admin: dùng được ở cả server và client

export const CUSTOMER_SORTS = [
  { value: "mua-gan-nhat", label: "Mua gần nhất", column: "last_order_at", ascending: false },
  { value: "chi-nhieu", label: "Chi tiêu nhiều nhất", column: "total_spent", ascending: false },
  { value: "moi-them", label: "Mới thêm", column: "created_at", ascending: false },
  { value: "ten", label: "Tên A–Z", column: "name", ascending: true },
] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number]["value"];

export const CUSTOMER_PAGE_SIZE = 20;

export type AdminCustomerQuery = {
  q: string;
  channel: (typeof CHANNEL_FILTERS)[number]["value"];
  sort: CustomerSort;
  page: number;
};

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseAdminCustomerQuery(params: Record<string, string | string[] | undefined>): AdminCustomerQuery {
  const channel = one(params.kenh);
  const sort = one(params["sap-xep"]);
  const page = Number.parseInt(one(params.trang), 10);
  return {
    q: one(params.q).trim().slice(0, 80),
    channel: CHANNEL_FILTERS.find((c) => c.value === channel)?.value ?? "",
    sort: CUSTOMER_SORTS.find((s) => s.value === sort)?.value ?? "mua-gan-nhat",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function adminCustomerSearch(query: AdminCustomerQuery, patch: Partial<AdminCustomerQuery> = {}): string {
  const next = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.channel) sp.set("kenh", next.channel);
  if (next.sort !== "mua-gan-nhat") sp.set("sap-xep", next.sort);
  if (next.page > 1) sp.set("trang", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
