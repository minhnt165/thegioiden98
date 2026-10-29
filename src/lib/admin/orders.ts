import "server-only";

import { tintFor } from "@/components/shop/ProductArt";
import { productImageUrl } from "@/lib/shop/catalog";
import { createClient } from "@/lib/supabase/server";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums, Json } from "@/types/database";
import { ORDER_PAGE_SIZE, ORDER_TABS, type AdminOrderQuery, type OrderTab } from "./order-filters";

// Dữ liệu đơn hàng cho admin (đọc theo phiên đăng nhập, RLS chỉ cho admin)

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 86_400_000;

/** Ngày "2026-10-29" theo giờ Việt Nam → mốc ISO đầu ngày */
function startOfDay(day: string, addDays = 0): string {
  return new Date(Date.parse(`${day}T00:00:00+07:00`) + addDays * DAY_MS).toISOString();
}

/** Ký tự đặc biệt của LIKE được hiểu theo nghĩa đen */
function likePattern(q: string): string {
  return `%${foldVietnamese(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Truy vấn view order_list với mọi bộ lọc trừ phân trang */
function orderListQuery(supabase: Supabase, query: AdminOrderQuery, withCount = false) {
  let builder = supabase.from("order_list").select("*", withCount ? { count: "exact" } : undefined);
  const status = ORDER_TABS.find((t) => t.value === query.tab)?.status;
  if (status) builder = builder.eq("status", status);
  if (query.channel) builder = builder.eq("channel", query.channel);
  if (query.payment) builder = builder.eq("payment", query.payment);
  if (query.from) builder = builder.gte("created_at", startOfDay(query.from));
  if (query.to) builder = builder.lt("created_at", startOfDay(query.to, 1));
  if (query.q) builder = builder.ilike("search", likePattern(query.q));
  return builder.order("created_at", { ascending: false });
}

export type AdminOrderRow = {
  id: string;
  code: string;
  status: Enums<"order_status">;
  channel: Enums<"sales_channel">;
  payment: Enums<"payment_method">;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  itemsSummary: string;
  variantHint: string;
  firstProductId: string | null;
  coverPath: string | null;
};

export async function getAdminOrders(query: AdminOrderQuery) {
  const supabase = await createClient();
  const countByStatus = (status: Enums<"order_status"> | null) => {
    const builder = supabase.from("orders").select("id", { count: "exact", head: true });
    return status ? builder.eq("status", status) : builder;
  };

  const from = (query.page - 1) * ORDER_PAGE_SIZE;
  const [listRes, ...countRes] = await Promise.all([
    orderListQuery(supabase, query, true).range(from, from + ORDER_PAGE_SIZE - 1),
    ...ORDER_TABS.map((t) => countByStatus(t.status)),
  ]);
  if (listRes.error?.code === "PGRST205") throw new Error("Chưa có view order_list — hãy chạy migration 20261029000006_admin_orders.sql.");
  // Trang vượt quá số đơn (PGRST103): coi như trang rỗng
  if (listRes.error && listRes.error.code !== "PGRST103") throw new Error(listRes.error.message);

  const list = listRes.data ?? [];
  const productIds = [...new Set(list.map((o) => o.first_product_id).filter((id): id is string => Boolean(id)))];
  const { data: covers } = productIds.length
    ? await supabase.from("product_images").select("product_id, storage_path").eq("is_cover", true).in("product_id", productIds)
    : { data: [] };
  const coverByProduct = new Map((covers ?? []).map((c) => [c.product_id, c.storage_path]));

  const rows: AdminOrderRow[] = list.map((o) => ({
    id: o.id!,
    code: o.code!,
    status: o.status!,
    channel: o.channel!,
    payment: o.payment!,
    total: o.total ?? 0,
    createdAt: o.created_at!,
    customerName: o.customer_name ?? "Khách lẻ",
    customerPhone: o.customer_phone,
    itemsSummary: o.items_summary ?? "—",
    variantHint: (o.item_count ?? 0) > 1 ? `${o.item_count} sản phẩm` : (o.first_variant ?? "—"),
    firstProductId: o.first_product_id,
    coverPath: o.first_product_id ? (coverByProduct.get(o.first_product_id) ?? null) : null,
  }));

  const total = listRes.count ?? 0;
  return {
    rows,
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)),
    counts: Object.fromEntries(ORDER_TABS.map((t, i) => [t.value, countRes[i].count ?? 0])) as Record<OrderTab, number>,
  };
}

// ---------- Xuất Excel ----------

export async function getOrdersForExport(query: AdminOrderQuery) {
  const supabase = await createClient();
  const rows = [];
  // PostgREST trả tối đa 1000 dòng mỗi lần
  for (let from = 0; ; from += 1000) {
    const { data, error } = await orderListQuery(supabase, query).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// ---------- Chi tiết đơn ----------

export type OrderItemView = {
  id: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  sku: string | null;
  productId: string | null;
  unitPrice: number;
  qty: number;
  coverPath: string | null;
};

export type OrderDetail = {
  id: string;
  code: string;
  status: Enums<"order_status">;
  channel: Enums<"sales_channel">;
  payment: Enums<"payment_method">;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  note: string | null;
  stockDeducted: boolean;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string | null; address: string | null; note: string | null } | null;
  sourceQuoteCode: string | null;
  items: OrderItemView[];
  events: { id: string; status: Enums<"order_status"> | null; note: string | null; createdAt: string }[];
};

async function fetchOrders(supabase: Supabase, ids: string[]): Promise<OrderDetail[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, customer:customers(id, name, phone, address, note), source_quote:quotes!orders_source_quote_id_fkey(code), order_items(id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order, variant:product_variants(sku, product_id)), order_events(id, status, note, created_at)",
    )
    .in("id", ids)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const productIds = [
    ...new Set(data.flatMap((o) => o.order_items.map((i) => i.variant?.product_id)).filter((id): id is string => Boolean(id))),
  ];
  const { data: covers } = productIds.length
    ? await supabase.from("product_images").select("product_id, storage_path").eq("is_cover", true).in("product_id", productIds)
    : { data: [] };
  const coverByProduct = new Map((covers ?? []).map((c) => [c.product_id, c.storage_path]));

  return data.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    channel: o.channel,
    payment: o.payment,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shipping_fee,
    total: o.total,
    note: o.note,
    stockDeducted: o.stock_deducted,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    customer: o.customer,
    sourceQuoteCode: o.source_quote?.code ?? null,
    items: [...o.order_items]
      .sort((a, b) => a.sort_order - b.sort_order || a.name_snapshot.localeCompare(b.name_snapshot, "vi"))
      .map((i) => ({
        id: i.id,
        variantId: i.variant_id,
        name: i.name_snapshot,
        variant: i.variant_snapshot,
        sku: i.variant?.sku ?? null,
        productId: i.variant?.product_id ?? null,
        unitPrice: i.unit_price,
        qty: i.qty,
        coverPath: i.variant?.product_id ? (coverByProduct.get(i.variant.product_id) ?? null) : null,
      })),
    events: [...o.order_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ id: e.id, status: e.status, note: e.note, createdAt: e.created_at })),
  }));
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const [order] = await fetchOrders(supabase, [id]);
  return order ?? null;
}

/** Nhiều đơn cho trang in phiếu giao, giữ thứ tự cũ → mới */
export async function getOrdersForSlip(ids: string[]): Promise<OrderDetail[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  return fetchOrders(supabase, ids);
}

// ---------- Form tạo / sửa đơn ----------

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  channel: Enums<"sales_channel">;
};

export type VariantOption = {
  id: string;
  productId: string;
  productName: string;
  productStatus: Enums<"product_status">;
  label: string | null;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  coverUrl: string | null;
  /** Màu nền ô ảnh khi chưa có ảnh bìa */
  tint: string;
};

export type OrderFormData = {
  id: string | null;
  code: string | null;
  customer: { id: string | null; name: string; phone: string; address: string };
  channel: Enums<"sales_channel">;
  payment: Enums<"payment_method">;
  discount: number;
  shippingFee: number;
  note: string;
  items: { variantId: string | null; name: string; variant: string | null; qty: number; unitPrice: number }[];
  /** Số lượng đơn này đang giữ trong kho theo SKU (sửa đơn thì được dùng lại) */
  reserved: Record<string, number>;
};

function optionLabel(values: Json, options: { name: string; sort_order: number }[]): string | null {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const parts = [...options]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => values[o.name])
    .filter((v): v is string => typeof v === "string" && v !== "");
  return parts.length ? parts.join(" · ") : null;
}

export async function getOrderFormOptions(): Promise<{ customers: CustomerOption[]; variants: VariantOption[] }> {
  const supabase = await createClient();
  const [customersRes, productsRes] = await Promise.all([
    supabase.from("customers").select("id, name, phone, address, channel").order("created_at", { ascending: false }).limit(1000),
    supabase
      .from("products")
      .select(
        "id, name, status, product_options(name, sort_order), product_variants(id, sku, price, stock, is_active, option_values, sort_order), product_images(storage_path, is_cover)",
      )
      .neq("status", "draft")
      .order("name"),
  ]);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const variants = productsRes.data.flatMap((p) => {
    const cover = p.product_images.find((img) => img.is_cover)?.storage_path ?? null;
    return [...p.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        productId: p.id,
        productName: p.name,
        productStatus: p.status,
        label: optionLabel(v.option_values, p.product_options),
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        isActive: v.is_active,
        coverUrl: cover ? productImageUrl(cover) : null,
        tint: tintFor(p.id),
      }));
  });

  return { customers: customersRes.data, variants };
}

/** Dữ liệu form sửa đơn; null khi không có đơn. Đơn đã qua bước chờ xác nhận thì không sửa được (trang tự chặn). */
export async function getOrderForm(id: string): Promise<(OrderFormData & { status: Enums<"order_status"> }) | null> {
  const order = await getOrderDetail(id);
  if (!order) return null;

  const reserved: Record<string, number> = {};
  if (order.stockDeducted) {
    for (const item of order.items) if (item.variantId) reserved[item.variantId] = (reserved[item.variantId] ?? 0) + item.qty;
  }

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    customer: {
      id: order.customer?.id ?? null,
      name: order.customer?.name ?? "",
      phone: order.customer?.phone ?? "",
      address: order.customer?.address ?? "",
    },
    channel: order.channel,
    payment: order.payment,
    discount: order.discount,
    shippingFee: order.shippingFee,
    note: order.note ?? "",
    items: order.items.map((i) => ({
      variantId: i.variantId,
      name: i.name,
      variant: i.variant,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
    reserved,
  };
}
