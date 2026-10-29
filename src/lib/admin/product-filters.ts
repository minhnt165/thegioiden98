// Bộ lọc danh sách sản phẩm admin: dùng được ở cả server và client

export const PRODUCT_TABS = [
  { value: "tat-ca", label: "Tất cả" },
  { value: "dang-ban", label: "Đang bán" },
  { value: "het-hang", label: "Hết hàng" },
  { value: "da-an", label: "Đã ẩn" },
  { value: "nhap", label: "Nháp" },
] as const;

export const STOCK_FILTERS = [
  { value: "", label: "Mọi mức tồn" },
  { value: "sap-het", label: "Sắp hết" },
  { value: "het", label: "Hết hàng" },
] as const;

export const ADMIN_SORTS = [
  { value: "moi-cap-nhat", label: "Mới cập nhật" },
  { value: "ban-chay", label: "Bán chạy" },
  { value: "gia-tang", label: "Giá tăng dần" },
  { value: "gia-giam", label: "Giá giảm dần" },
] as const;

export const ADMIN_PAGE_SIZE = 20;

export type Tab = (typeof PRODUCT_TABS)[number]["value"];

export type AdminProductQuery = {
  tab: Tab;
  q: string;
  category: string;
  stock: (typeof STOCK_FILTERS)[number]["value"];
  sort: (typeof ADMIN_SORTS)[number]["value"];
  page: number;
};

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseAdminProductQuery(params: Record<string, string | string[] | undefined>): AdminProductQuery {
  const tab = one(params.tab);
  const stock = one(params.ton);
  const sort = one(params["sap-xep"]);
  const page = Number.parseInt(one(params.trang), 10);
  return {
    tab: (PRODUCT_TABS.find((t) => t.value === tab)?.value ?? "tat-ca") as Tab,
    q: one(params.q).trim(),
    category: one(params["danh-muc"]),
    stock: STOCK_FILTERS.find((s) => s.value === stock)?.value ?? "",
    sort: ADMIN_SORTS.find((s) => s.value === sort)?.value ?? "moi-cap-nhat",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function adminProductSearch(query: AdminProductQuery, patch: Partial<AdminProductQuery> = {}): string {
  const next = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (next.tab !== "tat-ca") sp.set("tab", next.tab);
  if (next.q) sp.set("q", next.q);
  if (next.category) sp.set("danh-muc", next.category);
  if (next.stock) sp.set("ton", next.stock);
  if (next.sort !== "moi-cap-nhat") sp.set("sap-xep", next.sort);
  if (next.page > 1) sp.set("trang", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
