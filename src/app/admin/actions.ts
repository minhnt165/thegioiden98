"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeAdminPath } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; email: string };

const schema = z.object({
  email: z.email("Email chưa đúng định dạng."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = schema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Email hoặc mật khẩu không đúng."
        : error.code === "email_not_confirmed"
          ? "Tài khoản chưa được xác nhận email."
          : "Chưa đăng nhập được, thử lại sau ít phút.";
    return { error: message, email };
  }

  redirect(safeAdminPath(String(formData.get("next") ?? "")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/dang-nhap");
}
