import type { Metadata } from "next";
import Link from "next/link";
import { RangeSelect } from "@/components/admin/RangeSelect";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { BTN_PRIMARY, Badge, Card, PageHeader } from "@/components/admin/ui";
import { tintFor } from "@/components/shop/ProductArt";
import { getDashboardData } from "@/lib/admin/dashboard";
import { CHANNEL_LABEL, ORDER_STATUS } from "@/lib/admin/status";
import { formatVND } from "@/lib/format";

export const metadata: Metadata = { title: "Tổng quan" };

const TZ = "Asia/Ho_Chi_Minh";

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(now));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function longDate(now: Date) {
  const text = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** ▲ 12% so với tuần trước — xanh khi tăng, đỏ khi giảm, luôn kèm mũi tên + chữ */
function Delta({ value, previous, unit = "percent" }: { value: number; previous: number; unit?: "percent" | "count" }) {
  // Tuần trước bằng 0 thì % không có nghĩa: báo trung tính thay vì mũi tên
  if (!previous && unit === "percent") return <span className="text-[12px] text-muted">Tuần trước chưa có số liệu để so</span>;
  const diff = value - previous;
  const up = diff >= 0;
  const text = unit === "count" ? `${Math.abs(diff)} đơn` : `${Math.abs(Math.round((diff / previous) * 100))}%`;
  return (
    <span className={`text-[12px] ${up ? "text-status-green" : "text-status-red"}`}>
      {up ? "▲" : "▼"} {text} so với tuần trước
    </span>
  );
}

function Kpi({ label, value, footer }: { label: string; value: string; footer: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-line bg-white px-5 py-4.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[24px] font-medium md:text-[26px]">{value}</span>
      {footer}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const { khoang } = await searchParams;
  const range = khoang === "30" ? 30 : 7;
  const data = await getDashboardData(range);
  const now = new Date();

  const todo = [
    { label: "Chờ xác nhận", value: data.todo.pending, alert: true, href: "/admin/don-hang?tab=cho-xac-nhan" },
    { label: "Chờ đóng gói", value: data.todo.packing, href: "/admin/don-hang?tab=cho-dong-goi" },
    { label: "Đang giao", value: data.todo.shipping, href: "/admin/don-hang?tab=dang-giao" },
    { label: "Hết hàng", value: data.todo.outOfStock, alert: true, href: "/admin/san-pham?tab=het-hang" },
    { label: "Đổi trả", value: data.todo.returned, href: "/admin/don-hang?tab=doi-tra" },
  ];

  return (
    <>
      <PageHeader
        title={greeting(now)}
        subtitle={`${longDate(now)} · Doanh thu tính các đơn chưa hủy, chưa đổi trả`}
        actions={
          <Link href="/admin/san-pham/moi" className={BTN_PRIMARY}>
            + Thêm sản phẩm
          </Link>
        }
      />

      <Card title="Việc cần làm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {todo.map((t) => {
            const body = (
              <>
                <span className={`text-[26px] font-medium ${t.alert && t.value > 0 ? "text-terracotta" : ""}`}>{t.value}</span>
                <span className="text-[13px] text-muted">{t.label}</span>
              </>
            );
            const cls = "flex flex-col gap-1 rounded-xl bg-cream px-3.5 py-3";
            return t.href ? (
              <Link key={t.label} href={t.href} className={`${cls} hover:outline hover:outline-line`}>
                {body}
              </Link>
            ) : (
              <div key={t.label} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </Card>

      <section aria-label="Số liệu 7 ngày" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Doanh thu 7 ngày"
          value={formatVND(data.kpi.revenue.value)}
          footer={<Delta value={data.kpi.revenue.value} previous={data.kpi.revenue.previous} />}
        />
        <Kpi
          label="Đơn hàng 7 ngày"
          value={String(data.kpi.orders.value)}
          footer={<Delta value={data.kpi.orders.value} previous={data.kpi.orders.previous} unit="count" />}
        />
        <Kpi
          label="Giá trị trung bình / đơn"
          value={formatVND(data.kpi.averageOrder.value)}
          footer={<Delta value={data.kpi.averageOrder.value} previous={data.kpi.averageOrder.previous} />}
        />
        <Kpi
          label="Báo giá gửi trong 7 ngày"
          value={String(data.kpi.quotes.sent)}
          footer={
            <span className="text-[12px] text-muted">
              {data.kpi.quotes.sent
                ? `${Math.round((data.kpi.quotes.won / data.kpi.quotes.sent) * 100)}% khách đã đồng ý`
                : "Chưa gửi báo giá nào"}
            </span>
          }
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Doanh thu theo ngày" aside={<RangeSelect value={range} />} className="xl:col-span-7">
          <RevenueChart days={data.chart} />
        </Card>

        <Card
          title="Đơn mới nhất"
          aside={
            <Link href="/admin/don-hang" className="text-[13px] underline-offset-4 hover:underline">
              Xem tất cả
            </Link>
          }
          className="xl:col-span-5"
        >
          {data.recentOrders.length ? (
            <ul className="flex flex-col">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line-soft py-3 last:border-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/admin/don-hang/${o.id}`} className="truncate text-[14px] font-medium hover:text-terracotta">
                      {o.code} · {o.customer}
                    </Link>
                    <span className="truncate text-[12px] text-muted">
                      {o.summary} · {CHANNEL_LABEL[o.channel]}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[14px]">{formatVND(o.total)}</span>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Chưa có đơn trong 2 tuần gần đây.</p>
          )}
        </Card>
      </div>

      <Card
        title="Sắp hết hàng"
        aside={
          <Link href="/admin/san-pham?ton=sap-het" className="text-[13px] underline-offset-4 hover:underline">
            Quản lý kho
          </Link>
        }
      >
        {data.lowStock.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.lowStock.map((item, i) => (
              <li key={`${item.productId}-${i}`}>
                <Link
                  href={`/admin/san-pham/${item.productId}`}
                  title={item.label ? `${item.name} · ${item.label}` : item.name}
                  className="flex items-center gap-3 rounded-xl border border-line-soft p-2.5 hover:border-line"
                >
                  <span className={`size-11 shrink-0 rounded-[10px] ${tintFor(item.productId)}`} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium">
                      {item.name}
                      {item.label && ` · ${item.label}`}
                    </span>
                    <span className={`text-[12px] ${item.stock <= 0 ? "text-status-red" : "text-status-amber"}`}>
                      Còn {item.stock}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">Kho đang ổn — chưa có phân loại nào chạm ngưỡng cảnh báo.</p>
        )}
      </Card>
    </>
  );
}
