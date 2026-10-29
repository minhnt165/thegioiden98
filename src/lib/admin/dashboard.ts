import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";
import { REVENUE_EXCLUDED } from "./status";

const TZ = "Asia/Ho_Chi_Minh";
const DAY_MS = 86_400_000;
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-29" theo giờ Việt Nam */
export function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export type DayRevenue = { key: string; label: string; revenue: number; orders: number; isToday: boolean };

export type DashboardData = {
  todo: { pending: number; packing: number; shipping: number; outOfStock: number; returned: number };
  kpi: {
    revenue: { value: number; previous: number };
    orders: { value: number; previous: number };
    averageOrder: { value: number; previous: number };
    quotes: { sent: number; won: number };
  };
  chart: DayRevenue[];
  recentOrders: {
    id: string;
    code: string;
    customer: string;
    summary: string;
    channel: Enums<"sales_channel">;
    total: number;
    status: Enums<"order_status">;
  }[];
  lowStock: { productId: string; name: string; label: string | null; stock: number }[];
};

type OrderRow = {
  id: string;
  code: string;
  status: Enums<"order_status">;
  channel: Enums<"sales_channel">;
  total: number;
  created_at: string;
  customer: { name: string } | null;
  order_items: { name_snapshot: string; qty: number }[];
};

function sumWindow(orders: OrderRow[], from: number, to: number) {
  const inWindow = orders.filter((o) => {
    const t = Date.parse(o.created_at);
    return t >= from && t < to && !REVENUE_EXCLUDED.includes(o.status);
  });
  const revenue = inWindow.reduce((s, o) => s + o.total, 0);
  return { revenue, orders: inWindow.length, average: inWindow.length ? Math.round(revenue / inWindow.length) : 0 };
}

export async function getDashboardData(rangeDays: 7 | 30): Promise<DashboardData> {
  const supabase = await createClient();
  const now = Date.now();
  const since = new Date(now - Math.max(rangeDays, 14) * DAY_MS).toISOString();

  const countByStatus = (status: Enums<"order_status">) =>
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", status);

  const [pending, packing, shipping, returned, ordersRes, productsRes, thresholdRes, quotesRes] = await Promise.all([
    countByStatus("pending"),
    countByStatus("packing"),
    countByStatus("shipping"),
    countByStatus("returned"),
    supabase
      .from("orders")
      .select("id, code, status, channel, total, created_at, customer:customers(name), order_items(name_snapshot, qty)")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, status, low_stock_threshold, product_variants(stock, is_active, option_values, sort_order)")
      .eq("status", "active"),
    supabase.from("settings").select("value").eq("key", "low_stock_threshold").maybeSingle(),
    supabase.from("quotes").select("status, sent_at").gte("sent_at", new Date(now - 7 * DAY_MS).toISOString()),
  ]);

  for (const res of [ordersRes, productsRes, quotesRes]) if (res.error) throw new Error(res.error.message);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const weekAgo = now - 7 * DAY_MS;
  const current = sumWindow(orders, weekAgo, now + 1);
  const previous = sumWindow(orders, now - 14 * DAY_MS, weekAgo);

  // Doanh thu theo ngày (giờ Việt Nam)
  const todayKey = dayKey(new Date(now));
  const chart: DayRevenue[] = Array.from({ length: rangeDays }, (_, i) => {
    const date = new Date(now - (rangeDays - 1 - i) * DAY_MS);
    const key = dayKey(date);
    const weekday = new Date(`${key}T12:00:00+07:00`).getUTCDay();
    const label = key === todayKey ? "Hôm nay" : rangeDays === 7 ? WEEKDAY_SHORT[weekday] : `${key.slice(8)}/${key.slice(5, 7)}`;
    return { key, label, revenue: 0, orders: 0, isToday: key === todayKey };
  });
  const byKey = new Map(chart.map((d) => [d.key, d]));
  for (const o of orders) {
    if (REVENUE_EXCLUDED.includes(o.status)) continue;
    const day = byKey.get(dayKey(new Date(o.created_at)));
    if (day) {
      day.revenue += o.total;
      day.orders += 1;
    }
  }

  // Hết hàng & sắp hết
  const defaultThreshold = typeof thresholdRes.data?.value === "number" ? thresholdRes.data.value : 3;
  let outOfStock = 0;
  const lowStock: DashboardData["lowStock"] = [];
  for (const p of productsRes.data ?? []) {
    const variants = p.product_variants.filter((v) => v.is_active);
    if (variants.length && variants.every((v) => v.stock <= 0)) outOfStock += 1;
    const threshold = p.low_stock_threshold ?? defaultThreshold;
    for (const v of [...variants].sort((a, b) => a.sort_order - b.sort_order)) {
      if (v.stock > threshold) continue;
      const values = v.option_values && typeof v.option_values === "object" && !Array.isArray(v.option_values)
        ? Object.values(v.option_values).filter((x): x is string => typeof x === "string")
        : [];
      lowStock.push({ productId: p.id, name: p.name, label: values.join(" · ") || null, stock: v.stock });
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);

  const quotes = quotesRes.data ?? [];

  return {
    todo: {
      pending: pending.count ?? 0,
      packing: packing.count ?? 0,
      shipping: shipping.count ?? 0,
      outOfStock,
      returned: returned.count ?? 0,
    },
    kpi: {
      revenue: { value: current.revenue, previous: previous.revenue },
      orders: { value: current.orders, previous: previous.orders },
      averageOrder: { value: current.average, previous: previous.average },
      quotes: { sent: quotes.length, won: quotes.filter((q) => q.status === "accepted" || q.status === "ordered").length },
    },
    chart,
    recentOrders: orders.slice(0, 5).map((o) => ({
      id: o.id,
      code: o.code,
      customer: o.customer?.name ?? "Khách lẻ",
      summary: o.order_items.map((i) => `${i.name_snapshot} ×${i.qty}`).join(", "),
      channel: o.channel,
      total: o.total,
      status: o.status,
    })),
    lowStock: lowStock.slice(0, 8),
  };
}
