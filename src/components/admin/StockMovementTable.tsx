import Link from "next/link";
import { actorLabel, type StockMovementRow } from "@/lib/admin/stock";
import { STOCK_KIND, STOCK_REASON } from "@/lib/admin/status";
import { formatDateTime } from "@/lib/format";
import { Badge } from "./ui";

/** Người làm; không có phiên đăng nhập thì là khách bấm đồng ý trên link báo giá (đơn tự tạo) hoặc hệ thống */
function actorOf(m: StockMovementRow): string {
  return actorLabel(m) ?? (m.kind === "sale" && m.orderId ? "Khách (link báo giá)" : "Hệ thống");
}

/** Bảng dòng sổ kho: màn Kho (có cột sản phẩm) và khối "Lịch sử kho" ở trang sản phẩm (không cần) */
export function StockMovementTable({ rows, showProduct, empty }: { rows: StockMovementRow[]; showProduct: boolean; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className={`w-full border-collapse text-[14px] ${showProduct ? "min-w-250" : "min-w-190"}`}>
        <thead>
          <tr className="bg-cream text-left text-[12px] text-muted">
            <th className="px-4 py-3 font-medium">Thời gian</th>
            <th className="px-2 py-3 font-medium">{showProduct ? "Sản phẩm" : "Phân loại"}</th>
            <th className="px-2 py-3 font-medium">Loại</th>
            <th className="px-2 py-3 text-right font-medium">Thay đổi</th>
            <th className="px-2 py-3 text-right font-medium">Tồn sau</th>
            <th className="px-2 py-3 font-medium">Liên quan</th>
            <th className="px-2 py-3 font-medium">Lý do / ghi chú</th>
            <th className="px-4 py-3 font-medium">Người làm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-line-soft align-top">
              <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{formatDateTime(m.createdAt)}</td>
              {showProduct ? (
                <td className="px-2 py-3">
                  <span className="flex flex-col gap-0.5">
                    {m.productId ? (
                      <Link href={`/admin/san-pham/${m.productId}`} className="font-medium hover:text-terracotta">
                        {m.productName}
                      </Link>
                    ) : (
                      <span className="font-medium">{m.productName}</span>
                    )}
                    <span className="text-[12px] text-muted">
                      {[m.variantLabel, `SKU ${m.sku}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </td>
              ) : (
                <td className="px-2 py-3">
                  <span className="flex flex-col gap-0.5">
                    <span>{m.variantLabel ?? "Mặc định"}</span>
                    <span className="text-[12px] text-muted">SKU {m.sku}</span>
                  </span>
                </td>
              )}
              <td className="px-2 py-3">
                <Badge tone={STOCK_KIND[m.kind].tone}>{STOCK_KIND[m.kind].label}</Badge>
              </td>
              <td className={`whitespace-nowrap px-2 py-3 text-right font-medium tabular-nums ${m.delta > 0 ? "text-status-green" : "text-status-red"}`}>
                {m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{m.stockAfter}</td>
              <td className="whitespace-nowrap px-2 py-3 text-[13px]">
                {m.orderId && m.orderCode ? (
                  <Link href={`/admin/don-hang/${m.orderId}`} className="text-terracotta hover:underline">
                    Đơn {m.orderCode}
                  </Link>
                ) : m.receiptId && m.receiptCode ? (
                  <Link href={`/admin/kho/nhap/${m.receiptId}`} className="text-terracotta hover:underline">
                    {m.receiptCode}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="max-w-64 px-2 py-3 text-[13px]">
                {/* Dòng nhập hàng ghi chú bằng mã phiếu — đã có ở cột Liên quan */}
                {[m.reason ? STOCK_REASON[m.reason] : null, m.note !== m.receiptCode ? m.note : null].filter(Boolean).join(" · ") || (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-[13px] text-muted">{actorOf(m)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-[14px] text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
