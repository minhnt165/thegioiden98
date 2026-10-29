import "server-only";

import { createClient } from "@/lib/supabase/server";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums } from "@/types/database";
import { CUSTOMER_PAGE_SIZE, CUSTOMER_SORTS, type AdminCustomerQuery } from "./customer-filters";

// Dữ liệu khách hàng cho admin (đọc theo phiên đăng nhập, RLS chỉ cho admin)

/** Ký tự đặc biệt của LIKE được hiểu theo nghĩa đen */
function likePattern(q: string): string {
  return `%${foldVietnamese(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  channel: Enums<"sales_channel">;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  openQuoteCount: number;
};

export async function getAdminCustomers(query: AdminCustomerQuery) {
  const supabase = await createClient();
  const sort = CUSTOMER_SORTS.find((s) => s.value === query.sort) ?? CUSTOMER_SORTS[0];

  let builder = supabase.from("customer_list").select("*", { count: "exact" });
  if (query.channel) builder = builder.eq("channel", query.channel);
  if (query.q) builder = builder.ilike("search", likePattern(query.q));

  const from = (query.page - 1) * CUSTOMER_PAGE_SIZE;
  const res = await builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + CUSTOMER_PAGE_SIZE - 1);
  if (res.error?.code === "PGRST205") throw new Error("Chưa có view customer_list — hãy chạy migration 20261029000008_admin_customers.sql.");
  // Trang vượt quá số khách (PGRST103): coi như trang rỗng
  if (res.error && res.error.code !== "PGRST103") throw new Error(res.error.message);

  const rows: AdminCustomerRow[] = (res.data ?? []).map((c) => ({
    id: c.id!,
    name: c.name!,
    phone: c.phone,
    address: c.address,
    channel: c.channel!,
    orderCount: c.order_count ?? 0,
    totalSpent: c.total_spent ?? 0,
    lastOrderAt: c.last_order_at,
    openQuoteCount: c.open_quote_count ?? 0,
  }));

  const total = res.count ?? 0;
  return { rows, total, page: query.page, totalPages: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)) };
}

// ---------- Chi tiết khách ----------

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  channel: Enums<"sales_channel">;
  note: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  orders: { id: string; code: string; status: Enums<"order_status">; total: number; createdAt: string; itemsSummary: string }[];
  quotes: { id: string; code: string; status: Enums<"quote_status">; total: number; createdAt: string; validUntil: string | null; itemsSummary: string }[];
};

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const [customerRes, ordersRes, quotesRes] = await Promise.all([
    supabase.from("customer_list").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_list")
      .select("id, code, status, total, created_at, items_summary")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("quote_list")
      .select("id, code, status, total, created_at, valid_until, items_summary")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  for (const res of [customerRes, ordersRes, quotesRes]) if (res.error) throw new Error(res.error.message);
  const c = customerRes.data;
  if (!c) return null;

  return {
    id: c.id!,
    name: c.name!,
    phone: c.phone,
    address: c.address,
    channel: c.channel!,
    note: c.note,
    createdAt: c.created_at!,
    orderCount: c.order_count ?? 0,
    totalSpent: c.total_spent ?? 0,
    orders: (ordersRes.data ?? []).map((o) => ({
      id: o.id!,
      code: o.code!,
      status: o.status!,
      total: o.total ?? 0,
      createdAt: o.created_at!,
      itemsSummary: o.items_summary ?? "—",
    })),
    quotes: (quotesRes.data ?? []).map((q) => ({
      id: q.id!,
      code: q.code!,
      status: q.status!,
      total: q.total ?? 0,
      createdAt: q.created_at!,
      validUntil: q.valid_until,
      itemsSummary: q.items_summary ?? "—",
    })),
  };
}
