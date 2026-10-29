import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/PrintButton";
import { getCurrentUser } from "@/lib/admin/auth";
import { getOrdersForSlip } from "@/lib/admin/orders";
import { PAYMENT_LABEL } from "@/lib/admin/status";
import { formatDateTime, formatVND } from "@/lib/format";
import { getShopSettings } from "@/lib/shop/settings";

export const metadata: Metadata = { title: "Phiếu giao hàng" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Slips({ searchParams }: { searchParams: PageProps<"/admin/phieu-giao">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/dang-nhap");
  if (user.role !== "admin") return <p className="p-8 text-[14px]">Tài khoản chưa có quyền quản trị.</p>;

  const { ids } = await searchParams;
  const list = (Array.isArray(ids) ? ids.join(",") : (ids ?? "")).split(",").filter((id) => UUID.test(id)).slice(0, 200);
  const [orders, shop] = await Promise.all([getOrdersForSlip(list), getShopSettings()]);

  if (!orders.length) return <p className="p-8 text-[14px]">Không có đơn nào để in.</p>;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-3 print:hidden">
        <span className="text-[14px]">{orders.length} phiếu giao · khổ A5 dọc, mỗi đơn một trang</span>
        <PrintButton />
      </div>
      <div className="flex flex-col items-center gap-6 py-6 print:block print:p-0">
        {orders.map((o) => (
          <article
            key={o.id}
            className="flex w-full max-w-[148mm] flex-col gap-4 bg-white p-[10mm] text-[12px] text-ink shadow-sm break-after-page print:max-w-none print:shadow-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink pb-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-serif text-[20px] leading-none">{shop.shopName}</span>
                <span>{shop.address}</span>
                {shop.zaloPhone && <span>ĐT / Zalo: {shop.zaloPhone}</span>}
              </div>
              <div className="flex flex-col items-end gap-0.5 text-right">
                <span className="text-[11px] uppercase tracking-[0.12em]">Phiếu giao hàng</span>
                <span className="text-[18px] font-semibold">{o.code}</span>
                <span>{formatDateTime(o.createdAt)}</span>
              </div>
            </header>

            <section className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Người nhận</span>
              <span className="text-[14px] font-semibold">{o.customer?.name ?? "Khách lẻ"}</span>
              {o.customer?.phone && <span>{o.customer.phone}</span>}
              <span>{o.customer?.address || "……………………………………………………………………"}</span>
            </section>

            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-ink text-left">
                  <th className="py-1.5 pr-2 font-semibold">Sản phẩm</th>
                  <th className="px-2 py-1.5 text-right font-semibold">SL</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Đơn giá</th>
                  <th className="py-1.5 pl-2 text-right font-semibold">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id} className="border-b border-line">
                    <td className="py-1.5 pr-2">
                      {item.name}
                      {(item.variant || item.sku) && (
                        <span className="block text-[11px] text-muted">{[item.variant, item.sku].filter(Boolean).join(" · ")}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">{item.qty}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{formatVND(item.unitPrice)}</td>
                    <td className="whitespace-nowrap py-1.5 pl-2 text-right">{formatVND(item.unitPrice * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto flex w-60 flex-col gap-1">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span>{formatVND(o.subtotal)}</span>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <span>Giảm giá</span>
                  <span>−{formatVND(o.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Phí giao hàng</span>
                <span>{o.shippingFee ? formatVND(o.shippingFee) : "Miễn phí"}</span>
              </div>
              <div className="flex justify-between border-t border-ink pt-1 text-[14px] font-semibold">
                <span>Tổng cộng</span>
                <span>{formatVND(o.total)}</span>
              </div>
            </div>

            <div className="rounded-lg border-2 border-ink px-3 py-2 text-[14px] font-semibold">
              {o.payment === "cod" ? `Thu hộ (COD): ${formatVND(o.total)}` : `Đã thanh toán (${PAYMENT_LABEL[o.payment]}) — không thu tiền`}
            </div>

            {o.note && <p>Ghi chú: {o.note}</p>}

            <footer className="mt-auto grid grid-cols-2 gap-4 pt-6 text-center">
              <span className="flex flex-col gap-12">
                <span className="font-semibold">Người giao</span>
                <span className="text-muted">(Ký, ghi rõ họ tên)</span>
              </span>
              <span className="flex flex-col gap-12">
                <span className="font-semibold">Người nhận</span>
                <span className="text-muted">(Ký, ghi rõ họ tên)</span>
              </span>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

/** Trang in phiếu giao cho 1 hoặc nhiều đơn: /admin/phieu-giao?ids=<id>,<id> */
export default function DeliverySlipPage({ searchParams }: PageProps<"/admin/phieu-giao">) {
  return (
    <main className="min-h-full flex-1 bg-cream print:bg-white">
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>
      <Suspense fallback={<p className="p-8 text-[14px] text-muted">Đang chuẩn bị phiếu giao…</p>}>
        <Slips searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
