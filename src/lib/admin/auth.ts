import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Enums<"user_role"> | null;
};

/** Người dùng đang đăng nhập + role trong profiles. Gọi nhiều lần trong một request chỉ đọc một lần. */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", claims.sub).maybeSingle();
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? null,
  };
});

/** Dùng trong Server Action: chưa đăng nhập hoặc không phải admin thì dừng ngay. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/dang-nhap");
  if (user.role !== "admin") throw new Error("Tài khoản không có quyền quản trị.");
  return user;
}

/** Chỉ cho phép quay lại trang trong /admin sau khi đăng nhập (chặn open redirect) */
export function safeAdminPath(next: string | null | undefined): string {
  return next && /^\/admin(\/[\w\-/]*)?$/.test(next) && !next.startsWith("/admin/dang-nhap") ? next : "/admin";
}
