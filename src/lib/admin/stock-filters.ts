import type { Enums } from "@/types/database";
import { STOCK_KIND } from "./status";

// Bộ lọc màn Kho (tab Phiếu nhập / Lịch sử): dùng được ở cả server và client

export type StockTab = "phieu-nhap" | "lich-su";
type StockKind = Enums<"stock_movement_kind">;

export const STOCK_PAGE_SIZE = 30;

export type AdminStockQuery = {
  tab: StockTab;
  q: string;
  /** Lọc loại dòng sổ kho (tab Lịch sử), rỗng = mọi loại */
  kind: StockKind | "";
  /** Lọc theo sản phẩm (link "Xem tất cả" ở trang sản phẩm) */
  productId: string;
  /** "2026-10-29" theo giờ Việt Nam, rỗng = không giới hạn */
  from: string;
  to: string;
  page: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = Object.entries(STOCK_KIND) as [StockKind, (typeof STOCK_KIND)[StockKind]][];

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseAdminStockQuery(params: Record<string, string | string[] | undefined>): AdminStockQuery {
  const kind = one(params.loai);
  const productId = one(params.sp);
  const from = one(params.tu);
  const to = one(params.den);
  const page = Number.parseInt(one(params.trang), 10);
  return {
    tab: one(params.tab) === "lich-su" ? "lich-su" : "phieu-nhap",
    q: one(params.q).trim().slice(0, 80),
    kind: KINDS.find(([, k]) => k.slug === kind)?.[0] ?? "",
    productId: UUID.test(productId) ? productId : "",
    from: DAY.test(from) ? from : "",
    to: DAY.test(to) ? to : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function adminStockSearch(query: AdminStockQuery, patch: Partial<AdminStockQuery> = {}): string {
  const next = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (next.tab === "lich-su") sp.set("tab", next.tab);
  if (next.q) sp.set("q", next.q);
  if (next.kind) sp.set("loai", STOCK_KIND[next.kind].slug);
  if (next.productId) sp.set("sp", next.productId);
  if (next.from) sp.set("tu", next.from);
  if (next.to) sp.set("den", next.to);
  if (next.page > 1) sp.set("trang", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Truy vấn rỗng của một tab (dựng link) */
export const EMPTY_STOCK_QUERY: AdminStockQuery = { tab: "phieu-nhap", q: "", kind: "", productId: "", from: "", to: "", page: 1 };
