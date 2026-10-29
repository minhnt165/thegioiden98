import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

// Client theo phiên đăng nhập của người dùng (admin, Server Action). Đọc cookie nên chỉ gọi
// trong phạm vi request — với Cache Components phải nằm sau <Suspense> hoặc trong Server Action.
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Gọi từ Server Component thì không ghi được cookie; proxy.ts đã làm mới session.
        }
      },
    },
  });
}
