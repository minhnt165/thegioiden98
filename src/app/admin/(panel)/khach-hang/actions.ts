"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/(panel)/san-pham/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const customerSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Nhập tên khách hàng.").max(120, "Tên khách tối đa 120 ký tự."),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại quá dài.")
    .regex(/^[\d\s.+()-]*$/, "Số điện thoại chỉ gồm chữ số."),
  address: z.string().trim().max(300, "Địa chỉ tối đa 300 ký tự."),
  channel: z.enum(["zalo", "messenger", "showroom"]),
  note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự."),
});

export type CustomerPayload = z.input<typeof customerSchema>;

const digits = (phone: string | null) => (phone ?? "").replace(/\D/g, "");

/**
 * Thêm / sửa khách. Không cho 2 khách trùng SĐT: tạo đơn, báo giá tìm khách theo SĐT nên trùng sẽ
 * gắn đơn vào nhầm người.
 */
export async function saveCustomer(input: CustomerPayload): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  const c = parsed.data;
  const supabase = await createClient();

  if (digits(c.phone)) {
    const { data: others, error } = await supabase.from("customers").select("id, name, phone").not("phone", "is", null);
    if (error) return { ok: false, error: error.message };
    const same = others.find((o) => o.id !== c.id && digits(o.phone) === digits(c.phone));
    if (same) return { ok: false, error: `Số điện thoại này đã thuộc khách “${same.name}”.` };
  }

  const row = {
    name: c.name,
    phone: c.phone || null,
    address: c.address || null,
    channel: c.channel,
    note: c.note || null,
  };
  const { data, error } = c.id
    ? await supabase.from("customers").update(row).eq("id", c.id).select("id").maybeSingle()
    : await supabase.from("customers").insert(row).select("id").single();
  if (error) return { ok: false, error: `Chưa lưu được khách: ${error.message}` };
  if (!data) return { ok: false, error: "Không tìm thấy khách hàng." };

  refresh();
  return { ok: true, data: { id: data.id } };
}

/** Xóa khách chưa có đơn / báo giá nào (khách có lịch sử thì giữ lại để tra cứu) */
export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Yêu cầu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  // 23503: còn đơn / báo giá trỏ tới khách (khóa ngoại on delete restrict)
  if (error?.code === "23503") return { ok: false, error: "Khách đã có đơn hoặc báo giá nên không xóa được." };
  if (error) return { ok: false, error: `Chưa xóa được khách: ${error.message}` };
  return { ok: true, data: undefined };
}
