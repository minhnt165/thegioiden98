import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/admin/auth";
import { dayKey } from "@/lib/admin/dashboard";
import { parseAdminOrderQuery } from "@/lib/admin/order-filters";
import { getOrdersForExport } from "@/lib/admin/orders";
import { CHANNEL_NAME, ORDER_STATUS, PAYMENT_LABEL } from "@/lib/admin/status";
import { formatDateTime } from "@/lib/format";
import { buildXlsx, type Cell } from "@/lib/xlsx";

/** Xuất danh sách đơn ra Excel theo đúng bộ lọc đang xem (bỏ phân trang) */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Không có quyền xuất đơn hàng.", { status: 403 });

  const query = parseAdminOrderQuery(Object.fromEntries(request.nextUrl.searchParams));
  const orders = await getOrdersForExport(query);

  const rows: Cell[][] = [
    ["Mã đơn", "Ngày tạo", "Trạng thái", "Khách hàng", "SĐT", "Địa chỉ", "Sản phẩm", "Kênh", "Thanh toán", "Tạm tính", "Giảm giá", "Phí giao", "Tổng tiền", "Ghi chú"],
    ...orders.map((o) => [
      o.code,
      formatDateTime(o.created_at),
      o.status ? ORDER_STATUS[o.status].label : "",
      o.customer_name ?? "Khách lẻ",
      o.customer_phone,
      o.customer_address,
      o.items_summary,
      o.channel ? CHANNEL_NAME[o.channel].label : "",
      o.payment ? PAYMENT_LABEL[o.payment] : "",
      o.subtotal,
      o.discount,
      o.shipping_fee,
      o.total,
      o.note,
    ]),
  ];
  const file = buildXlsx("Đơn hàng", rows, [9, 17, 14, 22, 13, 36, 44, 11, 13, 12, 11, 11, 12, 30]);

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="don-hang-${dayKey(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
