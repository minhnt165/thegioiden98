import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderNote, OrderStatusActions } from "@/components/admin/OrderActions";
import { BTN_PRIMARY, BTN_SECONDARY, Badge, Card, PageHeader } from "@/components/admin/ui";
import { tintFor } from "@/components/shop/ProductArt";
import { getOrderDetail } from "@/lib/admin/orders";
import { CHANNEL_NAME, ORDER_STATUS, PAYMENT_LABEL } from "@/lib/admin/status";
import { formatDateTime, formatVND } from "@/lib/format";
import { productImageUrl } from "@/lib/shop/catalog";
import { zaloLink } from "@/lib/shop/contact";

export const metadata: Metadata = { title: "Chi tiết đơn" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-[16px] font-medium" : "text-[14px]"}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default async function OrderDetailPage({ params }: PageProps<"/admin/don-hang/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const status = ORDER_STATUS[order.status];
  const zalo = order.customer?.phone ? zaloLink(order.customer.phone) : null;

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/admin/don-hang", label: "Đơn hàng" }]}
        title={`Đơn ${order.code}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            Tạo lúc {formatDateTime(order.createdAt)} · {CHANNEL_NAME[order.channel].label}
            {order.sourceQuoteCode && ` · từ báo giá ${order.sourceQuoteCode}`}
          </span>
        }
        actions={
          <>
            <a href={`/admin/phieu-giao?ids=${order.id}`} target="_blank" className={BTN_SECONDARY}>
              In phiếu giao
            </a>
            {order.status === "pending" && (
              <Link href={`/admin/don-hang/${order.id}/sua`} className={BTN_PRIMARY}>
                Sửa đơn
              </Link>
            )}
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card title={`Sản phẩm (${order.items.reduce((s, i) => s + i.qty, 0)})`}>
            <ul className="flex flex-col">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 border-b border-line-soft py-3 first:pt-0">
                  <span className={`relative size-12 shrink-0 overflow-hidden rounded-input ${tintFor(item.productId ?? item.id)}`}>
                    {item.coverPath && <Image src={productImageUrl(item.coverPath)} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {item.productId ? (
                      <Link href={`/admin/san-pham/${item.productId}`} className="truncate text-[14px] font-medium hover:text-terracotta">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="truncate text-[14px] font-medium">{item.name}</span>
                    )}
                    <span className="truncate text-[12px] text-muted">
                      {[item.variant, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ") || "Không phân loại"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-muted">
                    {formatVND(item.unitPrice)} × {item.qty}
                  </span>
                  <span className="w-28 shrink-0 text-right text-[14px] font-medium">{formatVND(item.unitPrice * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex w-full max-w-80 flex-col gap-2 pt-1">
              <Row label="Tạm tính">{formatVND(order.subtotal)}</Row>
              {order.discount > 0 && <Row label="Giảm giá">−{formatVND(order.discount)}</Row>}
              <Row label="Phí giao hàng">{order.shippingFee ? formatVND(order.shippingFee) : "Miễn phí"}</Row>
              <div className="border-t border-line-soft pt-2">
                <Row label="Tổng cộng" strong>
                  {formatVND(order.total)}
                </Row>
              </div>
            </div>
          </Card>

          <Card title="Lịch sử">
            <ol className="flex flex-col gap-3.5 border-l border-line pl-4">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="relative flex flex-col gap-0.5">
                  <span aria-hidden className="absolute -left-5.25 top-1.5 size-2.5 rounded-full border-2 border-white bg-terracotta" />
                  <span className="text-[14px]">
                    {e.status ? ORDER_STATUS[e.status].label : e.note}
                    {e.status && e.note && <span className="text-muted"> — {e.note}</span>}
                  </span>
                  <span className="text-[12px] text-muted">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card title="Xử lý đơn">
            <OrderStatusActions id={order.id} status={order.status} />
            <p className="text-[12px] leading-relaxed text-muted">
              {order.stockDeducted
                ? "Đã trừ kho khi tạo đơn. Hủy hoặc ghi nhận trả hàng sẽ cộng lại kho."
                : order.status === "cancelled" || order.status === "returned"
                  ? "Đơn đã đóng; kho không còn giữ hàng cho đơn này."
                  : "Đơn tạo trước khi có quản lý kho theo đơn — đổi trạng thái không làm thay đổi tồn kho."}
            </p>
          </Card>

          <Card title="Khách hàng">
            {order.customer ? (
              <div className="flex flex-col gap-1.5 text-[14px]">
                <Link href={`/admin/khach-hang/${order.customer.id}`} className="font-medium hover:text-terracotta">
                  {order.customer.name}
                </Link>
                {order.customer.phone && (
                  <span className="flex flex-wrap items-center gap-3">
                    <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline">
                      {order.customer.phone}
                    </a>
                    {zalo && (
                      <a href={zalo} target="_blank" rel="noopener noreferrer" className="text-[13px] text-zalo underline-offset-4 hover:underline">
                        Nhắn Zalo
                      </a>
                    )}
                  </span>
                )}
                <span className="text-muted">{order.customer.address || "Chưa có địa chỉ giao"}</span>
                {order.customer.note && <span className="text-[13px] text-muted">Ghi chú khách: {order.customer.note}</span>}
              </div>
            ) : (
              <p className="text-[14px] text-muted">Khách lẻ, không lưu thông tin.</p>
            )}
          </Card>

          <Card title="Thanh toán">
            <div className="flex flex-col gap-2">
              <Row label="Hình thức">{PAYMENT_LABEL[order.payment]}</Row>
              <Row label={order.payment === "cod" ? "Thu khi giao" : "Số tiền"}>{formatVND(order.total)}</Row>
            </div>
          </Card>

          <Card title="Ghi chú nội bộ">
            <OrderNote id={order.id} note={order.note} />
          </Card>
        </div>
      </div>
    </>
  );
}
