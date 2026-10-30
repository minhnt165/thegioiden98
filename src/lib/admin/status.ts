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

export const QUOTE_STATUS: Record<Enums<"quote_status">, { label: string; tone: Tone }> = {
  draft: { label: "Nháp", tone: "gray" },
  sent: { label: "Đã gửi", tone: "blue" },
  viewed: { label: "Khách đã xem", tone: "amber" },
  accepted: { label: "Khách đồng ý", tone: "green" },
  ordered: { label: "Đã thành đơn", tone: "green" },
  expired: { label: "Hết hạn", tone: "red" },
  rejected: { label: "Khách từ chối", tone: "gray" },
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

/** Tên kênh đứng riêng (cột "Kênh", bộ lọc) + màu chấm theo mockup */
export const CHANNEL_NAME: Record<Enums<"sales_channel">, { label: string; color: string }> = {
  zalo: { label: "Zalo", color: "bg-zalo" },
  messenger: { label: "Messenger", color: "bg-messenger" },
  showroom: { label: "Showroom", color: "bg-muted" },
};

export const PAYMENT_LABEL: Record<Enums<"payment_method">, string> = {
  cod: "COD",
  bank_transfer: "Chuyển khoản",
  cash: "Tiền mặt",
};

/** Loại dòng sổ kho; slug dùng cho bộ lọc ?loai= */
export const STOCK_KIND: Record<Enums<"stock_movement_kind">, { label: string; tone: Tone; slug: string }> = {
  initial: { label: "Tồn đầu", tone: "gray", slug: "ton-dau" },
  receipt: { label: "Nhập hàng", tone: "green", slug: "nhap" },
  sale: { label: "Bán", tone: "blue", slug: "ban" },
  return: { label: "Hủy / trả", tone: "amber", slug: "huy-tra" },
  adjust: { label: "Điều chỉnh", tone: "red", slug: "dieu-chinh" },
};

export const STOCK_REASON: Record<Enums<"stock_adjust_reason">, string> = {
  damaged: "Vỡ / hỏng",
  count: "Kiểm kê lệch",
  other: "Khác",
};

/** Đơn tính vào doanh thu: mọi trạng thái trừ hủy và đổi trả */
export const REVENUE_EXCLUDED: Enums<"order_status">[] = ["cancelled", "returned"];
