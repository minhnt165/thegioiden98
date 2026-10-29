import "server-only";

import { createClient } from "@/lib/supabase/server";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums } from "@/types/database";
import {
  QUOTE_PAGE_SIZE,
  QUOTE_TABS,
  addDays,
  effectiveQuoteStatus,
  vnToday,
  type AdminQuoteQuery,
  type QuoteTab,
} from "./quote-filters";

// Dữ liệu báo giá cho admin (đọc theo phiên đăng nhập, RLS chỉ cho admin)

const DAY_MS = 86_400_000;

/** Ký tự đặc biệt của LIKE được hiểu theo nghĩa đen */
function likePattern(q: string): string {
  return `%${foldVietnamese(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type AdminQuoteRow = {
  id: string;
  code: string;
  status: Enums<"quote_status">;
  channel: Enums<"sales_channel">;
  total: number;
  validUntil: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  itemsSummary: string;
  orderId: string | null;
  token: string;
};

export type QuoteKpi = {
  /** Đã gửi / khách đã xem, còn hiệu lực */
  waiting: number;
  /** Trong số đang chờ, hết hiệu lực trong ≤ 2 ngày */
  expiringSoon: number;
  /** % báo giá gửi trong 30 ngày đã được khách đồng ý; null khi chưa gửi báo giá nào */
  winRate: number | null;
  waitingValue: number;
};

export async function getAdminQuotes(query: AdminQuoteQuery) {
  const supabase = await createClient();
  const today = vnToday();

  let list = supabase.from("quote_list").select("*", { count: "exact" });
  const statuses = QUOTE_TABS.find((t) => t.value === query.tab)?.statuses;
  if (statuses) list = list.in("status", statuses);
  if (query.channel) list = list.eq("channel", query.channel);
  if (query.q) list = list.ilike("search", likePattern(query.q));

  const countByTab = (s: readonly Enums<"quote_status">[] | null) => {
    const builder = supabase.from("quote_list").select("id", { count: "exact", head: true });
    return s ? builder.in("status", s) : builder;
  };

  const from = (query.page - 1) * QUOTE_PAGE_SIZE;
  const [listRes, waitingRes, sentRes, ...countRes] = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, from + QUOTE_PAGE_SIZE - 1),
    supabase.from("quote_list").select("total, valid_until").in("status", ["sent", "viewed"]),
    supabase.from("quotes").select("status").gte("sent_at", new Date(Date.now() - 30 * DAY_MS).toISOString()),
    ...QUOTE_TABS.map((t) => countByTab(t.statuses)),
  ]);
  if (listRes.error?.code === "PGRST205") throw new Error("Chưa có view quote_list — hãy chạy migration 20261029000007_admin_quotes.sql.");
  // Trang vượt quá số báo giá (PGRST103): coi như trang rỗng
  if (listRes.error && listRes.error.code !== "PGRST103") throw new Error(listRes.error.message);
  for (const res of [waitingRes, sentRes]) if (res.error) throw new Error(res.error.message);

  const data = listRes.data ?? [];
  const ids = data.map((q) => q.id!);
  const { data: tokens } = ids.length ? await supabase.from("quotes").select("id, public_token").in("id", ids) : { data: [] };
  const tokenById = new Map((tokens ?? []).map((t) => [t.id, t.public_token]));

  const rows: AdminQuoteRow[] = data.map((q) => ({
    id: q.id!,
    code: q.code!,
    status: q.status!,
    channel: q.channel!,
    total: q.total ?? 0,
    validUntil: q.valid_until,
    createdAt: q.created_at!,
    customerName: q.customer_name ?? "Khách lẻ",
    customerPhone: q.customer_phone,
    itemsSummary: q.items_summary ?? "—",
    orderId: q.order_id,
    token: tokenById.get(q.id!) ?? "",
  }));

  const waiting = waitingRes.data ?? [];
  const sent = sentRes.data ?? [];
  const soon = addDays(today, 2);
  const kpi: QuoteKpi = {
    waiting: waiting.length,
    expiringSoon: waiting.filter((q) => q.valid_until !== null && q.valid_until <= soon).length,
    winRate: sent.length ? Math.round((sent.filter((q) => q.status === "accepted" || q.status === "ordered").length / sent.length) * 100) : null,
    waitingValue: waiting.reduce((s, q) => s + (q.total ?? 0), 0),
  };

  const total = listRes.count ?? 0;
  return {
    rows,
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / QUOTE_PAGE_SIZE)),
    counts: Object.fromEntries(QUOTE_TABS.map((t, i) => [t.value, countRes[i].count ?? 0])) as Record<QuoteTab, number>,
    kpi,
    today,
  };
}

// ---------- Form lập / sửa báo giá ----------

export type QuoteFormData = {
  id: string | null;
  code: string | null;
  /** Trạng thái thực tế (đã tính hết hạn) */
  status: Enums<"quote_status">;
  token: string | null;
  customer: { id: string | null; name: string; phone: string; address: string };
  channel: Enums<"sales_channel">;
  message: string;
  terms: string;
  discountPercent: number;
  shippingFee: number;
  validUntil: string;
  items: { variantId: string | null; name: string; variant: string | null; qty: number; unitPrice: number }[];
  progress: {
    createdAt: string;
    createdBy: string | null;
    sentAt: string | null;
    viewedAt: string | null;
    viewCount: number;
    acceptedAt: string | null;
    order: { id: string; code: string } | null;
  } | null;
};

/** Mặc định cho báo giá mới: điều khoản + số ngày hiệu lực trong cài đặt */
export async function getNewQuoteForm(): Promise<QuoteFormData> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("key, value").in("key", ["quote_default_terms", "quote_validity_days"]);
  if (error) throw new Error(error.message);
  const map = new Map(data.map((row) => [row.key, row.value]));
  const terms = map.get("quote_default_terms");
  const days = Number(map.get("quote_validity_days"));

  return {
    id: null,
    code: null,
    status: "draft",
    token: null,
    customer: { id: null, name: "", phone: "", address: "" },
    channel: "zalo",
    message: "",
    terms: typeof terms === "string" ? terms : "",
    discountPercent: 0,
    shippingFee: 0,
    validUntil: addDays(vnToday(), Number.isInteger(days) && days > 0 ? days : 7),
    items: [],
    progress: null,
  };
}

export async function getQuoteForm(id: string): Promise<QuoteFormData | null> {
  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("quotes")
    .select(
      "*, customer:customers(id, name, phone, address), order:orders!quotes_order_id_fkey(id, code), quote_items(variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!q) return null;

  const { data: author } = q.created_by
    ? await supabase.from("profiles").select("full_name").eq("id", q.created_by).maybeSingle()
    : { data: null };

  return {
    id: q.id,
    code: q.code,
    status: effectiveQuoteStatus(q.status, q.valid_until),
    token: q.public_token,
    customer: {
      id: q.customer?.id ?? null,
      name: q.customer?.name ?? "",
      phone: q.customer?.phone ?? "",
      address: q.customer?.address ?? "",
    },
    channel: q.channel,
    message: q.message ?? "",
    terms: q.terms ?? "",
    discountPercent: Number(q.discount_percent),
    shippingFee: q.shipping_fee,
    validUntil: q.valid_until ?? vnToday(),
    items: [...q.quote_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ variantId: i.variant_id, name: i.name_snapshot, variant: i.variant_snapshot, qty: i.qty, unitPrice: i.unit_price })),
    progress: {
      createdAt: q.created_at,
      createdBy: author?.full_name ?? (q.created_by ? "Admin" : null),
      sentAt: q.sent_at,
      viewedAt: q.viewed_at,
      viewCount: q.view_count,
      acceptedAt: q.accepted_at,
      order: q.order,
    },
  };
}

/** Số ngày hiệu lực mặc định (dùng khi gia hạn) */
export async function getQuoteValidityDays(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "quote_validity_days").maybeSingle();
  const days = Number(data?.value);
  return Number.isInteger(days) && days > 0 ? days : 7;
}
