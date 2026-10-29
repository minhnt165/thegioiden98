"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/(panel)/san-pham/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { addDays, vnToday } from "@/lib/admin/quote-filters";
import { getQuoteValidityDays } from "@/lib/admin/quotes";
import { createClient } from "@/lib/supabase/server";

const money = z.number({ error: "Số tiền phải là số." }).int().min(0, "Số tiền không được âm.").max(10_000_000_000, "Số tiền quá lớn.");

const quoteSchema = z.object({
  id: z.uuid().nullable(),
  customer: z.object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1, "Nhập tên khách hàng.").max(120, "Tên khách tối đa 120 ký tự."),
    phone: z
      .string()
      .trim()
      .max(20, "Số điện thoại quá dài.")
      .regex(/^[\d\s.+()-]*$/, "Số điện thoại chỉ gồm chữ số."),
    address: z.string().trim().max(300, "Địa chỉ tối đa 300 ký tự."),
  }),
  channel: z.enum(["zalo", "messenger", "showroom"]),
  message: z.string().trim().max(2000, "Lời nhắn tối đa 2000 ký tự."),
  terms: z.string().trim().max(3000, "Điều khoản tối đa 3000 ký tự."),
  discountPercent: z.number({ error: "Giảm giá phải là số." }).min(0, "Giảm giá không được âm.").max(100, "Giảm giá tối đa 100%."),
  shippingFee: money,
  validUntil: z.iso.date({ error: "Chọn ngày hết hiệu lực." }),
  send: z.boolean(),
  items: z
    .array(
      z.object({
        variantId: z.uuid({ error: "Có sản phẩm không còn bán — xóa dòng đó rồi chọn lại." }),
        qty: z.number().int().min(1, "Số lượng tối thiểu là 1.").max(9999, "Số lượng quá lớn."),
        unitPrice: money,
      }),
    )
    .min(1, "Báo giá cần ít nhất 1 sản phẩm.")
    .max(100, "Báo giá tối đa 100 dòng sản phẩm."),
});

export type QuotePayload = z.input<typeof quoteSchema>;

function translateDbError(error: { code?: string; message: string }, action: string): string {
  // P0001: thông báo nghiệp vụ viết sẵn tiếng Việt trong hàm SQL
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Tài khoản không có quyền sửa báo giá.";
  if (error.code === "PGRST202") return "Chưa có hàm xử lý báo giá — hãy chạy migration 20261029000007_admin_quotes.sql.";
  return `${action} chưa được: ${error.message}`;
}

/** Lập hoặc sửa báo giá. send = true: chuyển nháp / hết hạn sang "đã gửi". */
export async function saveQuote(
  input: QuotePayload,
): Promise<ActionResult<{ id: string; code: string; token: string; status: string }>> {
  await requireAdmin();
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const q = parsed.data;
  if (q.send && q.validUntil < vnToday()) return { ok: false, error: "Ngày hiệu lực đã qua — chọn ngày khác trước khi gửi." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_quote", {
    p: {
      id: q.id,
      customer: { id: q.customer.id, name: q.customer.name, phone: q.customer.phone, address: q.customer.address },
      channel: q.channel,
      message: q.message,
      terms: q.terms,
      discount_percent: q.discountPercent,
      shipping_fee: q.shippingFee,
      valid_until: q.validUntil,
      send: q.send,
      items: q.items.map((i) => ({ variant_id: i.variantId, qty: i.qty, unit_price: i.unitPrice })),
    },
  });
  if (error) return { ok: false, error: translateDbError(error, "Lưu báo giá") };

  refresh();
  const result = data as { id: string; code: string; public_token: string; status: string };
  return { ok: true, data: { id: result.id, code: result.code, token: result.public_token, status: result.status } };
}

/** Tạo đơn chờ xác nhận từ báo giá (trừ kho). Trả về đơn mới để chuyển sang trang đơn. */
export async function convertQuoteToOrder(id: string): Promise<ActionResult<{ id: string; code: string }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_quote_to_order", { p_id: id });
  if (error) return { ok: false, error: translateDbError(error, "Tạo đơn") };

  updateTag("products");
  refresh();
  return { ok: true, data: data as { id: string; code: string } };
}

/** Chép link / nhắn Zalo cho khách: báo giá nháp chuyển sang "đã gửi" */
export async function markQuoteSent(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: `Chưa cập nhật được báo giá: ${error.message}` };
  refresh();
  return { ok: true, data: undefined };
}

/** Gia hạn thêm số ngày hiệu lực mặc định tính từ hôm nay; báo giá đã hết hạn coi như gửi lại */
export async function extendQuote(id: string): Promise<ActionResult<{ validUntil: string }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { data: quote, error: readError } = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!quote || !["sent", "viewed", "expired"].includes(quote.status)) return { ok: false, error: "Báo giá này không gia hạn được." };

  const validUntil = addDays(vnToday(), await getQuoteValidityDays());
  const { error } = await supabase
    .from("quotes")
    .update({ valid_until: validUntil, ...(quote.status === "expired" ? { status: "sent" as const, sent_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .eq("status", quote.status);
  if (error) return { ok: false, error: `Chưa gia hạn được: ${error.message}` };
  refresh();
  return { ok: true, data: { validUntil } };
}

/** Khách báo không lấy: đóng báo giá (link vẫn mở được nhưng không bấm đồng ý được nữa) */
export async function rejectQuote(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "rejected" })
    .eq("id", id)
    .in("status", ["sent", "viewed", "accepted", "expired"])
    .select("id");
  if (error) return { ok: false, error: `Chưa cập nhật được báo giá: ${error.message}` };
  if (!data.length) return { ok: false, error: "Báo giá vừa được đổi ở nơi khác — tải lại trang để xem." };
  refresh();
  return { ok: true, data: undefined };
}
