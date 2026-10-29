"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/(panel)/san-pham/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const money = z.number({ error: "Số tiền phải là số." }).int().min(0, "Số tiền không được âm.").max(10_000_000_000, "Số tiền quá lớn.");

const orderSchema = z.object({
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
  payment: z.enum(["cod", "bank_transfer", "cash"]),
  discount: money,
  shippingFee: money,
  note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự."),
  items: z
    .array(
      z.object({
        variantId: z.uuid({ error: "Có sản phẩm không còn trong kho — xóa dòng đó rồi chọn lại." }),
        qty: z.number().int().min(1, "Số lượng tối thiểu là 1.").max(9999, "Số lượng quá lớn."),
        unitPrice: money,
      }),
    )
    .min(1, "Đơn cần ít nhất 1 sản phẩm.")
    .max(100, "Đơn tối đa 100 dòng sản phẩm."),
});

export type OrderPayload = z.input<typeof orderSchema>;

function translateDbError(error: { code?: string; message: string }, action: string): string {
  // P0001: thông báo nghiệp vụ viết sẵn tiếng Việt trong hàm SQL
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Tài khoản không có quyền sửa đơn hàng.";
  if (error.code === "PGRST202") return "Chưa có hàm xử lý đơn — hãy chạy migration 20261029000006_admin_orders.sql.";
  return `${action} chưa được: ${error.message}`;
}

/** Tạo đơn thủ công hoặc sửa đơn đang chờ xác nhận. Kho được trừ ngay khi lưu. */
export async function saveOrder(input: OrderPayload): Promise<ActionResult<{ id: string; code: string }>> {
  await requireAdmin();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const o = parsed.data;

  const subtotal = o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  if (o.discount > subtotal) return { ok: false, error: "Giảm giá không được lớn hơn tạm tính." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_order", {
    p: {
      id: o.id,
      customer: { id: o.customer.id, name: o.customer.name, phone: o.customer.phone, address: o.customer.address },
      channel: o.channel,
      payment: o.payment,
      discount: o.discount,
      shipping_fee: o.shippingFee,
      note: o.note,
      items: o.items.map((i) => ({ variant_id: i.variantId, qty: i.qty, unit_price: i.unitPrice })),
    },
  });
  if (error) return { ok: false, error: translateDbError(error, "Lưu đơn") };

  // Tồn kho hiển thị trên cửa hàng đổi theo đơn
  updateTag("products");
  const result = data as { id: string; code: string };
  return { ok: true, data: { id: result.id, code: result.code } };
}

const statusSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  status: z.enum(["packing", "shipping", "done", "cancelled", "returned"]),
  note: z.string().trim().max(500, "Lý do tối đa 500 ký tự."),
});

/** Đổi trạng thái 1 hoặc nhiều đơn. Đơn không ở bước phù hợp thì bỏ qua; trả về số đơn đã đổi. */
export async function setOrdersStatus(
  ids: string[],
  status: "packing" | "shipping" | "done" | "cancelled" | "returned",
  note = "",
): Promise<ActionResult<{ changed: number }>> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({ ids, status, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_order_status", {
    p_ids: parsed.data.ids,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: translateDbError(error, "Đổi trạng thái") };

  if (status === "cancelled" || status === "returned") updateTag("products");
  // Đơn chỉ đọc theo phiên (không cache) nên chỉ cần làm mới trang + số đơn chờ ở menu
  refresh();
  return { ok: true, data: { changed: data ?? 0 } };
}

const noteSchema = z.object({ id: z.uuid(), note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự.") });

/** Ghi chú nội bộ sửa được ở mọi trạng thái */
export async function updateOrderNote(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = noteSchema.safeParse({ id, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ note: parsed.data.note || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: `Chưa lưu được ghi chú: ${error.message}` };
  refresh();
  return { ok: true, data: undefined };
}
