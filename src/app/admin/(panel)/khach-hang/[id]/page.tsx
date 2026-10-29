import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { BTN_PRIMARY, BTN_SECONDARY, Badge, Card, PageHeader } from "@/components/admin/ui";
import { getCustomerDetail } from "@/lib/admin/customers";
import { formatDay } from "@/lib/admin/quote-filters";
import { CHANNEL_NAME, ORDER_STATUS, QUOTE_STATUS } from "@/lib/admin/status";
import { formatDate, formatVND } from "@/lib/format";
import { zaloLink } from "@/lib/shop/contact";

export const metadata: Metadata = { title: "Khách hàng" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-5 py-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[20px] font-medium">{value}</span>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: PageProps<"/admin/khach-hang/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const zalo = customer.phone ? zaloLink(customer.phone) : null;
  const lastOrder = customer.orders[0];

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/admin/khach-hang", label: "Khách hàng" }]}
        title={customer.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Khách từ {formatDate(customer.createdAt)} · {CHANNEL_NAME[customer.channel].label}
            </span>
            {customer.phone && (
              <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="text-ink underline-offset-4 hover:underline">
                {customer.phone}
              </a>
            )}
            {zalo && (
              <a href={zalo} target="_blank" rel="noopener noreferrer" className="text-zalo underline-offset-4 hover:underline">
                Nhắn Zalo
              </a>
            )}
          </span>
        }
        actions={
          <>
            <Link href={`/admin/bao-gia/moi?khach=${customer.id}`} className={BTN_SECONDARY}>
              + Lập báo giá
            </Link>
            <Link href={`/admin/don-hang/moi?khach=${customer.id}`} className={BTN_PRIMARY}>
              + Tạo đơn
            </Link>
          </>
        }
      />

      <section aria-label="Tình hình mua hàng" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Stat label="Số đơn" value={String(customer.orderCount)} />
        <Stat label="Tổng chi tiêu" value={formatVND(customer.totalSpent)} />
        <Stat label="Trung bình / đơn" value={customer.orderCount ? formatVND(Math.round(customer.totalSpent / customer.orderCount)) : "—"} />
        <Stat label="Đơn gần nhất" value={lastOrder ? formatDate(lastOrder.createdAt) : "Chưa mua"} />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card title={`Đơn hàng (${customer.orders.length})`}>
            {customer.orders.length ? (
              <ul className="flex flex-col">
                {customer.orders.map((o) => {
                  const status = ORDER_STATUS[o.status];
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-3 first:pt-0 last:border-0 last:pb-0">
                      <Link href={`/admin/don-hang/${o.id}`} className="w-16 font-medium hover:text-terracotta">
                        {o.code}
                      </Link>
                      <span className="w-24 text-[13px] text-muted">{formatDate(o.createdAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{o.itemsSummary}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="w-28 text-right text-[14px] font-medium">{formatVND(o.total)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">Khách chưa có đơn nào.</p>
            )}
          </Card>

          <Card title={`Báo giá (${customer.quotes.length})`}>
            {customer.quotes.length ? (
              <ul className="flex flex-col">
                {customer.quotes.map((q) => {
                  const status = QUOTE_STATUS[q.status];
                  return (
                    <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-3 first:pt-0 last:border-0 last:pb-0">
                      <Link href={`/admin/bao-gia/${q.id}`} className="w-16 font-medium hover:text-terracotta">
                        {q.code}
                      </Link>
                      <span className="w-24 text-[13px] text-muted">{formatDate(q.createdAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {q.itemsSummary}
                        {q.validUntil && (q.status === "sent" || q.status === "viewed") && (
                          <span className="text-muted"> · giữ giá đến {formatDay(q.validUntil)}</span>
                        )}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="w-28 text-right text-[14px] font-medium">{formatVND(q.total)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">Khách chưa có báo giá nào.</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card title="Thông tin khách">
            <CustomerForm
              key={customer.id}
              initial={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone ?? "",
                address: customer.address ?? "",
                channel: customer.channel,
                note: customer.note ?? "",
              }}
              canDelete={!customer.orders.length && !customer.quotes.length}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
