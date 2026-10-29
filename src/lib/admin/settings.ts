import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// Các key trong bảng settings mà trang /admin/cai-dat quản lý.
// isPublic: cửa hàng (khách chưa đăng nhập) được đọc.
export const SETTING_KEYS = {
  shop_name: { isPublic: true, kind: "text" },
  shop_address: { isPublic: true, kind: "text" },
  opening_hours: { isPublic: true, kind: "text" },
  zalo_phone: { isPublic: true, kind: "text" },
  messenger_url: { isPublic: true, kind: "text" },
  instagram_url: { isPublic: true, kind: "text" },
  delivery_time: { isPublic: true, kind: "text" },
  preorder_time: { isPublic: true, kind: "text" },
  shipping_notes: { isPublic: true, kind: "lines" },
  about_text: { isPublic: true, kind: "text" },
  quote_default_terms: { isPublic: false, kind: "text" },
  quote_validity_days: { isPublic: false, kind: "number" },
  low_stock_threshold: { isPublic: false, kind: "number" },
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;
export type SettingsValues = Record<SettingKey, string>;

function toText(value: Json | undefined): string {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join("\n");
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export async function getAllSettings(): Promise<SettingsValues> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw new Error(error.message);
  const map = new Map(data.map((row) => [row.key, row.value]));
  return Object.fromEntries(Object.keys(SETTING_KEYS).map((key) => [key, toText(map.get(key))])) as SettingsValues;
}
