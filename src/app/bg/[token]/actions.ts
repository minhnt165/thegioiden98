"use server";

import { refresh } from "next/cache";
import { isQuoteToken } from "@/lib/shop/quote";
import { createAdminClient } from "@/lib/supabase/admin";

export type AcceptState = { error: string | null };

/** Khách bấm "Đồng ý & đặt hàng" trên link báo giá. Bấm lại không tạo thêm đơn. */
export async function acceptQuote(token: string): Promise<AcceptState> {
  if (!isQuoteToken(token)) return { error: "Link báo giá không hợp lệ." };
  const { data, error } = await createAdminClient().rpc("public_accept_quote", { p_token: token });
  if (error) {
    console.error("Không ghi nhận được đồng ý báo giá:", error.message);
    return { error: "Chưa ghi nhận được — bạn thử lại sau ít phút hoặc nhắn Zalo cho shop nhé." };
  }
  const result = data as { status?: string; error?: string };
  // Hết hạn / đã đóng: trang tự hiện thông báo tương ứng sau khi tải lại
  if (result.error === "not_found") return { error: "Không tìm thấy báo giá này." };
  refresh();
  return { error: null };
}
