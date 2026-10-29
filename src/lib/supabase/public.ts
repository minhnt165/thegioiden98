import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

// Client ẩn danh, không đọc cookie: dùng cho dữ liệu công khai của cửa hàng bên trong "use cache".
// RLS chỉ cho thấy danh mục, sản phẩm đang bán và cài đặt công khai.
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
