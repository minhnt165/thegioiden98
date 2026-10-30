"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/(panel)/san-pham/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const adjustSchema = z.object({
  variantId: z.uuid(),
  delta: z
    .number({ error: "Nhập số thay đổi." })
    .int("Số thay đổi phải là số nguyên.")
    .refine((n) => n !== 0, "Nhập số thay đổi khác 0.")
    .refine((n) => Math.abs(n) <= 100_000, "Số thay đổi quá lớn."),
  reason: z.enum(["damaged", "count", "other"], { error: "Chọn lý do điều chỉnh." }),
  note: z.string().trim().max(300, "Ghi chú tối đa 300 ký tự."),
});

const receiptSchema = z.object({
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự."),
  items: z
    .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1, "Số lượng nhập phải từ 1.").max(100_000, "Số lượng nhập tối đa 100000.") }))
    .min(1, "Thêm ít nhất 1 sản phẩm vào phiếu.")
    .max(200, "Mỗi phiếu tối đa 200 dòng."),
});

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Tài khoản không có quyền sửa tồn kho.";
  if (error.code === "PGRST202") return "Chưa có hàm sổ kho — hãy chạy migration 20261030000001_stock_ledger.sql.";
  return `Chưa lưu được: ${error.message}`;
}

/** Điều chỉnh tồn một phân loại (vỡ / hỏng, kiểm kê lệch, khác). Trả về tồn mới. */
export async function adjustStock(input: z.input<typeof adjustSchema>): Promise<ActionResult<{ stock: number }>> {
  await requireAdmin();
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const { variantId, delta, reason, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_stock", { p_variant_id: variantId, p_delta: delta, p_reason: reason, p_note: note });
  if (error) return { ok: false, error: translateDbError(error) };

  // Cửa hàng hiện còn / hết hàng theo tồn (tag "products" gắn cả trang chi tiết)
  updateTag("products");
  return { ok: true, data: { stock: data } };
}

/** Lập phiếu nhập: cộng kho mọi dòng. Phiếu đã lưu không sửa / xóa. */
export async function createStockReceipt(input: z.input<typeof receiptSchema>): Promise<ActionResult<{ id: string; code: string }>> {
  await requireAdmin();
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const { note, items } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_stock_receipt", {
    p: { note, items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })) },
  });
  if (error) return { ok: false, error: translateDbError(error) };

  updateTag("products");
  return { ok: true, data: data as { id: string; code: string } };
}
