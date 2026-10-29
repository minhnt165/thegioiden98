"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export type NewsletterState = { status: "idle" | "success" | "error"; message: string };

const schema = z.object({
  email: z.email("Email chưa đúng định dạng.").max(254, "Email quá dài."),
});

// Ghi bằng service role: bảng newsletter_subscribers không mở quyền ghi cho khách.
export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({ email: String(formData.get("email") ?? "").trim().toLowerCase() });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Email chưa hợp lệ." };
  }

  try {
    const { error } = await createAdminClient().from("newsletter_subscribers").insert({ email: parsed.data.email });
    // 23505: email đã có — vẫn báo thành công, không cho biết email nào đã đăng ký
    if (error && error.code !== "23505") throw error;
  } catch (error) {
    console.error("Đăng ký nhận tin thất bại:", error);
    return { status: "error", message: "Chưa đăng ký được, bạn thử lại sau ít phút nhé." };
  }

  return { status: "success", message: "Cảm ơn bạn! Shop sẽ gửi tin mới qua email này." };
}
