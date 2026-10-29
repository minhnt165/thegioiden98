import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type ShopSettings = {
  shopName: string;
  address: string;
  openingHours: string;
  zaloPhone: string;
  messengerUrl: string;
  instagramUrl: string;
  deliveryTime: string;
  preorderTime: string;
  shippingNotes: string[];
  aboutText: string;
};

// Giá trị mặc định khi bảng settings chưa có key (hoặc chưa kết nối Supabase)
const DEFAULTS: ShopSettings = {
  shopName: "Thế Giới Đèn 98",
  address: "An Khánh, Hà Nội",
  openingHours: "9h–17h",
  zaloPhone: "",
  messengerUrl: "",
  instagramUrl: "",
  deliveryTime: "1–3 ngày",
  preorderTime: "2–3 tuần",
  shippingNotes: [
    "Đóng gói thùng carton hai lớp, chèn mút chống sốc.",
    "Giao nội thành Hà Nội: 1–2 ngày. Tỉnh khác: 3–5 ngày.",
    "Đổi trả trong 7 ngày nếu lỗi do sản xuất.",
  ],
  aboutText:
    "Một cửa hàng nhỏ ở An Khánh, chọn từng chiếc đèn, chiếc ghế từ những xưởng thủ công trong nước — đủ đẹp để nhìn cả ngày, đủ bền để dùng nhiều năm.",
};

const KEY_MAP: Record<string, keyof ShopSettings> = {
  shop_name: "shopName",
  shop_address: "address",
  opening_hours: "openingHours",
  zalo_phone: "zaloPhone",
  messenger_url: "messengerUrl",
  instagram_url: "instagramUrl",
  delivery_time: "deliveryTime",
  preorder_time: "preorderTime",
  shipping_notes: "shippingNotes",
  about_text: "aboutText",
};

async function fetchPublicSettings(): Promise<ShopSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");

  const supabase = createPublicClient();
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw new Error(error.message);

  const settings: ShopSettings = { ...DEFAULTS };
  for (const row of data) {
    const field = KEY_MAP[row.key];
    if (!field) continue;
    if (field === "shippingNotes") {
      if (Array.isArray(row.value)) settings.shippingNotes = row.value.filter((v): v is string => typeof v === "string");
    } else if (typeof row.value === "string") {
      settings[field] = row.value.trim();
    }
  }
  return settings;
}

/** Cài đặt công khai của shop (SĐT Zalo, link MXH, giờ mở cửa…). Lỗi kết nối thì dùng mặc định. */
export async function getShopSettings(): Promise<ShopSettings> {
  if (!isSupabaseConfigured()) return DEFAULTS;
  try {
    return await fetchPublicSettings();
  } catch (error) {
    console.error("Không đọc được settings:", error);
    return DEFAULTS;
  }
}
