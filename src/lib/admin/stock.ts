import "server-only";

import { createClient } from "@/lib/supabase/server";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Database, Enums } from "@/types/database";
import { STOCK_PAGE_SIZE, type AdminStockQuery } from "./stock-filters";

// Dữ liệu sổ kho / phiếu nhập cho admin (đọc theo phiên đăng nhập, RLS chỉ cho admin)

const DAY_MS = 86_400_000;

/** Ngày "2026-10-29" theo giờ Việt Nam → mốc ISO đầu ngày */
function startOfDay(day: string, addDays = 0): string {
  return new Date(Date.parse(`${day}T00:00:00+07:00`) + addDays * DAY_MS).toISOString();
}

/** Ký tự đặc biệt của LIKE được hiểu theo nghĩa đen */
function likePattern(q: string): string {
  return `%${foldVietnamese(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function pageResult<T>(rows: T[], count: number | null, page: number) {
  const total = count ?? 0;
  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / STOCK_PAGE_SIZE)) };
}

// ---------- Lịch sử kho ----------

export type StockMovementRow = {
  id: string;
  createdAt: string;
  kind: Enums<"stock_movement_kind">;
  reason: Enums<"stock_adjust_reason"> | null;
  note: string | null;
  delta: number;
  stockAfter: number;
  productId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string;
  orderId: string | null;
  orderCode: string | null;
  receiptId: string | null;
  receiptCode: string | null;
  actorName: string | null;
};

type MovementListRow = Database["public"]["Views"]["stock_movement_list"]["Row"];

function toMovement(m: MovementListRow): StockMovementRow {
  return {
    id: m.id!,
    createdAt: m.created_at!,
    kind: m.kind!,
    reason: m.reason,
    note: m.note,
    delta: m.delta ?? 0,
    stockAfter: m.stock_after ?? 0,
    productId: m.product_id,
    productName: m.product_name ?? m.name_snapshot ?? "",
    variantLabel: m.variant_snapshot,
    sku: m.sku_snapshot ?? "",
    orderId: m.order_id,
    orderCode: m.order_code,
    receiptId: m.receipt_id,
    receiptCode: m.receipt_code,
    actorName: m.actor_name,
  };
}

function viewMissing(code: string | undefined) {
  if (code === "PGRST205") throw new Error("Chưa có view sổ kho — hãy chạy migration 20261030000001_stock_ledger.sql.");
}

export async function getStockMovements(query: AdminStockQuery) {
  const supabase = await createClient();
  let builder = supabase.from("stock_movement_list").select("*", { count: "exact" });
  if (query.kind) builder = builder.eq("kind", query.kind);
  if (query.productId) builder = builder.eq("product_id", query.productId);
  if (query.from) builder = builder.gte("created_at", startOfDay(query.from));
  if (query.to) builder = builder.lt("created_at", startOfDay(query.to, 1));
  if (query.q) builder = builder.ilike("search", likePattern(query.q));

  const from = (query.page - 1) * STOCK_PAGE_SIZE;
  const res = await builder.order("created_at", { ascending: false }).range(from, from + STOCK_PAGE_SIZE - 1);
  viewMissing(res.error?.code);
  // Trang vượt quá số dòng (PGRST103): coi như trang rỗng
  if (res.error && res.error.code !== "PGRST103") throw new Error(res.error.message);
  return pageResult((res.data ?? []).map(toMovement), res.count, query.page);
}

/** Các dòng gần nhất của một sản phẩm (khối "Lịch sử kho" ở trang sửa sản phẩm) */
export async function getProductStockHistory(productId: string, limit = 10): Promise<StockMovementRow[]> {
  const supabase = await createClient();
  const res = await supabase
    .from("stock_movement_list")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  viewMissing(res.error?.code);
  if (res.error) throw new Error(res.error.message);
  return res.data.map(toMovement);
}

// ---------- Phiếu nhập ----------

export type StockReceiptRow = {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  itemCount: number;
  totalQty: number;
  itemsSummary: string | null;
  actorName: string | null;
};

export type StockReceiptItem = { productId: string | null; productName: string; variantLabel: string | null; sku: string; qty: number };

function toReceipt(r: Database["public"]["Views"]["stock_receipt_list"]["Row"]): StockReceiptRow {
  return {
    id: r.id!,
    code: r.code!,
    note: r.note,
    createdAt: r.created_at!,
    itemCount: r.item_count ?? 0,
    totalQty: r.total_qty ?? 0,
    itemsSummary: r.items_summary,
    actorName: r.actor_name,
  };
}

export async function getStockReceipts(query: AdminStockQuery) {
  const supabase = await createClient();
  let builder = supabase.from("stock_receipt_list").select("*", { count: "exact" });
  if (query.q) builder = builder.ilike("search", likePattern(query.q));

  const from = (query.page - 1) * STOCK_PAGE_SIZE;
  const res = await builder.order("created_at", { ascending: false }).range(from, from + STOCK_PAGE_SIZE - 1);
  viewMissing(res.error?.code);
  if (res.error && res.error.code !== "PGRST103") throw new Error(res.error.message);
  return pageResult((res.data ?? []).map(toReceipt), res.count, query.page);
}

/** Phiếu nhập + các dòng; null khi không có */
export async function getStockReceipt(id: string): Promise<{ receipt: StockReceiptRow; items: StockReceiptItem[] } | null> {
  const supabase = await createClient();
  const [receiptRes, itemsRes] = await Promise.all([
    supabase.from("stock_receipt_list").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("stock_receipt_items")
      .select("product_id, name_snapshot, variant_snapshot, sku_snapshot, qty, product:products(name)")
      .eq("receipt_id", id)
      .order("sort_order"),
  ]);
  viewMissing(receiptRes.error?.code);
  if (receiptRes.error) throw new Error(receiptRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (!receiptRes.data) return null;

  return {
    receipt: toReceipt(receiptRes.data),
    items: itemsRes.data.map((i) => ({
      productId: i.product_id,
      productName: i.product?.name ?? i.name_snapshot,
      variantLabel: i.variant_snapshot,
      sku: i.sku_snapshot,
      qty: i.qty,
    })),
  };
}

/** Tên sản phẩm cho chip bộ lọc "Sản phẩm: …" */
export async function getProductName(productId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
  return data?.name ?? null;
}
