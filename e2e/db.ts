import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

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
  const { data: customers } = await supabase.from("customers").select("id").eq("phone", phone);
  for (const { id } of customers ?? []) {
    const { data: orders } = await supabase.from("orders").select("id, stock_deducted, order_items(variant_id, qty)").eq("customer_id", id);
    for (const order of orders ?? []) {
      if (order.stock_deducted) {
        for (const item of order.order_items) {
          if (!item.variant_id) continue;
          const stock = await stockOf(item.variant_id);
          await supabase.from("product_variants").update({ stock: stock + item.qty }).eq("id", item.variant_id);
        }
      }
      await supabase.from("quotes").update({ order_id: null }).eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
    }
    await supabase.from("quotes").delete().eq("customer_id", id);
    await supabase.from("customers").delete().eq("id", id);
  }
}
