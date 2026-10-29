"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { SETTING_KEYS, type SettingKey } from "@/lib/admin/settings";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type SettingsState = { status: "idle" | "success" | "error"; message: string };

const httpsUrl = z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Link phải bắt đầu bằng https://" })]);

const schema = z.object({
  shop_name: z.string().trim().min(1, "Nhập tên shop.").max(80),
  shop_address: z.string().trim().max(160),
  opening_hours: z.string().trim().max(60),
  zalo_phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^(\+?84|0)\d{9,10}$/.test(v.replace(/[\s.-]/g, "")), "SĐT Zalo chưa đúng (vd 0912 345 678)."),
  messenger_url: httpsUrl,
  instagram_url: httpsUrl,
  delivery_time: z.string().trim().max(40),
  preorder_time: z.string().trim().max(40),
  shipping_notes: z.string().max(2000),
  about_text: z.string().trim().max(600),
  quote_default_terms: z.string().trim().max(3000),
  quote_validity_days: z.coerce.number().int().min(1, "Hiệu lực báo giá ít nhất 1 ngày.").max(90, "Hiệu lực báo giá tối đa 90 ngày."),
  low_stock_threshold: z.coerce.number().int().min(0).max(999),
});

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const raw = Object.fromEntries(Object.keys(SETTING_KEYS).map((key) => [key, String(formData.get(key) ?? "")]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };

  const rows = (Object.keys(SETTING_KEYS) as SettingKey[]).map((key) => {
    const def = SETTING_KEYS[key];
    const value = parsed.data[key];
    let json: Json;
    if (def.kind === "lines") json = String(value).split("\n").map((l) => l.trim()).filter(Boolean);
    else if (key === "zalo_phone") json = String(value).replace(/[\s.-]/g, "");
    else json = value;
    return { key, value: json, is_public: def.isPublic };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { status: "error", message: `Chưa lưu được: ${error.message}` };

  updateTag("settings");
  return { status: "success", message: "Đã lưu cài đặt. Cửa hàng cập nhật ngay." };
}
