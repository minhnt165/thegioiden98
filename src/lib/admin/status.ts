import type { Enums } from "@/types/database";

// Nhãn & màu badge dùng chung ở admin

type Tone = "amber" | "blue" | "green" | "red" | "gray";

export const TONE_CLASS: Record<Tone, string> = {
  amber: "bg-status-amber-bg text-status-amber",
  blue: "bg-status-blue-bg text-status-blue",
  green: "bg-status-green-bg text-status-green",
  red: "bg-status-red-bg text-status-red",
  gray: "bg-status-gray-bg text-status-gray",
};

export const ORDER_STATUS: Record<Enums<"order_status">, { label: string; tone: Tone }> = {
  pending: { label: "Chờ xác nhận", tone: "amber" },
  packing: { label: "Chờ đóng gói", tone: "blue" },
  shipping: { label: "Đang giao", tone: "blue" },
  done: { label: "Hoàn tất", tone: "green" },
  cancelled: { label: "Đã hủy", tone: "gray" },
  returned: { label: "Đổi trả", tone: "red" },
};

export const PRODUCT_STATUS: Record<Enums<"product_status">, { label: string; tone: Tone }> = {
  active: { label: "Đang bán", tone: "green" },
  hidden: { label: "Đã ẩn", tone: "gray" },
  draft: { label: "Nháp", tone: "amber" },
};

export const CHANNEL_LABEL: Record<Enums<"sales_channel">, string> = {
  zalo: "qua Zalo",
  messenger: "qua Messenger",
  showroom: "tại showroom",
};

/** Đơn tính vào doanh thu: mọi trạng thái trừ hủy và đổi trả */
export const REVENUE_EXCLUDED: Enums<"order_status">[] = ["cancelled", "returned"];
