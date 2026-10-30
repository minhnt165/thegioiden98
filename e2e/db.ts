import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../src/types/database";

// Truy cập DB bằng service role cho test: chuẩn bị tài khoản admin, đọc kết quả, dọn dữ liệu test.

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function adminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Thiếu E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD trong .env");
  return { email, password };
}

/** Tạo (nếu chưa có) tài khoản admin riêng cho test và cấp quyền admin */
export async function ensureAdminUser() {
  const supabase = db();
  const { email, password } = adminCredentials();

  let userId: string | undefined;
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "E2E Admin" } });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // Đã có: tìm lại và đặt lại mật khẩu theo .env
    for (let page = 1; !userId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      userId = data.users.find((u) => u.email === email)?.id;
      if (data.users.length < 200) break;
    }
    if (!userId) throw created.error ?? new Error("Không tạo được tài khoản test");
    await supabase.auth.admin.updateUserById(userId, { password });
  }

  const { error } = await supabase.from("profiles").upsert({ id: userId, role: "admin", full_name: "E2E Admin" });
  if (error) throw error;
}

/** Một phân loại đang bán, còn ít nhất `minStock` trong kho */
export async function pickVariant(minStock = 3) {
  const { data, error } = await db()
    .from("product_variants")
    .select("id, sku, price, stock, product:products!inner(name, status)")
    .eq("is_active", true)
    .eq("products.status", "active")
    .gte("stock", minStock)
    .gt("price", 0)
    .order("stock", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return { id: data.id, sku: data.sku, price: data.price, productName: data.product.name };
}

export async function stockOf(variantId: string): Promise<number> {
  const { data, error } = await db().from("product_variants").select("stock").eq("id", variantId).single();
  if (error) throw error;
  return data.stock;
}

/** Số điện thoại riêng cho mỗi lần chạy, để dọn đúng dữ liệu test */
export function testPhone(): string {
  return `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

/** Xóa khách test theo SĐT kèm đơn (trả lại kho đã trừ) và báo giá của họ */
export async function cleanupCustomer(phone: string) {
  const supabase = db();
  const startedAt = new Date().toISOString();
  const { data: customers } = await supabase.from("customers").select("id").eq("phone", phone);
  for (const { id } of customers ?? []) {
    const { data: orders } = await supabase.from("orders").select("id, stock_deducted, order_items(variant_id, qty)").eq("customer_id", id);
    for (const order of orders ?? []) {
      if (order.stock_deducted) {
        for (const item of order.order_items) {
          if (!item.variant_id) continue;
          const stock = await stockOf(item.variant_id);
          await supabase.from("product_variants").update({ stock: stock + item.qty }).eq("id", item.variant_id);
          // Trả kho bằng service role cũng được sổ kho ghi lại ("Sửa trực tiếp") — xóa dòng đó, không để rác
          await supabase
            .from("stock_movements")
            .delete()
            .eq("variant_id", item.variant_id)
            .eq("kind", "adjust")
            .eq("note", "Sửa trực tiếp")
            .is("created_by", null)
            .gte("created_at", startedAt);
        }
      }
      await supabase.from("quotes").update({ order_id: null }).eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
    }
    await supabase.from("quotes").delete().eq("customer_id", id);
    await supabase.from("customers").delete().eq("id", id);
  }
}

let adminClient: Promise<SupabaseClient<Database>> | null = null;

/** Client đăng nhập bằng tài khoản admin test: gọi các hàm admin_* đúng như admin thật (qua RLS) */
export function adminDb(): Promise<SupabaseClient<Database>> {
  adminClient ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env");
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword(adminCredentials());
    if (error) throw error;
    return client;
  })();
  return adminClient;
}

export type TestProduct = { productId: string; variantId: string; sku: string; name: string; slug: string };

/** Payload admin_save_product cho sản phẩm test (nháp, 1 nhóm "Màu" tùy chọn) */
export function testProductPayload(
  p: { productId: string; name: string; slug: string },
  variants: { id: string | null; sku: string; stock: number; option_values?: Record<string, string> }[],
  options: { name: string; values: { value: string; hex: string | null }[] }[] = [],
) {
  return {
    id: p.productId,
    name: p.name,
    slug: p.slug,
    category_id: "",
    status: "draft",
    base_price: 100000,
    options,
    variants: variants.map((v) => ({ price: 100000, is_active: true, option_values: {}, ...v })),
    images: [],
  };
}

/** Tạo sản phẩm nháp riêng cho test, 1 phân loại giá 100.000₫ */
export async function createTestProduct(opts: { stock?: number; withColor?: boolean } = {}): Promise<TestProduct> {
  const n = String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
  const base = { productId: crypto.randomUUID(), name: `E2E Đèn bàn ${n}`, slug: `e2e-den-ban-${n}` };
  const sku = `E2E-${n}-${opts.withColor ? "TR" : "MD"}`;
  const options = opts.withColor ? [{ name: "Màu", values: [{ value: "Trắng", hex: "#FFFFFF" }] }] : [];
  const payload = testProductPayload(
    base,
    [{ id: null, sku, stock: opts.stock ?? 5, option_values: opts.withColor ? { Màu: "Trắng" } : {} }],
    options,
  );
  const { error } = await (await adminDb()).rpc("admin_save_product", { p: payload });
  if (error) throw error;
  const { data, error: readError } = await db().from("product_variants").select("id").eq("product_id", base.productId).single();
  if (readError) throw readError;
  return { ...base, variantId: data.id, sku };
}

/** Các dòng sổ kho theo sản phẩm / đơn / phiếu, cũ trước */
export async function movementsOf(filter: { productId?: string; orderId?: string; receiptId?: string }): Promise<Tables<"stock_movements">[]> {
  let query = db().from("stock_movements").select("*");
  if (filter.productId) query = query.eq("product_id", filter.productId);
  if (filter.orderId) query = query.eq("order_id", filter.orderId);
  if (filter.receiptId) query = query.eq("receipt_id", filter.receiptId);
  const { data, error } = await query.order("created_at").order("id");
  if (error) throw error;
  return data;
}

/** Xóa sản phẩm test cùng sổ kho và phiếu nhập test của nó */
export async function cleanupTestProduct(productId: string) {
  const supabase = db();
  const { data: items } = await supabase.from("stock_receipt_items").select("receipt_id").eq("product_id", productId);
  await supabase.from("stock_movements").delete().eq("product_id", productId);
  const receiptIds = [...new Set((items ?? []).map((i) => i.receipt_id))];
  if (receiptIds.length) await supabase.from("stock_receipts").delete().in("id", receiptIds).like("note", "E2E%");
  await supabase.from("products").delete().eq("id", productId);
}
