import type { Metadata } from "next";
import Link from "next/link";
import { OrderFilters } from "@/components/admin/OrderFilters";
import { OrderTable } from "@/components/admin/OrderTable";
import { BTN_PRIMARY, BTN_SECONDARY, PageHeader, Pagination } from "@/components/admin/ui";
import { tintFor } from "@/components/shop/ProductArt";
import { ORDER_PAGE_SIZE, ORDER_TABS, adminOrderSearch, parseAdminOrderQuery } from "@/lib/admin/order-filters";
import { getAdminOrders } from "@/lib/admin/orders";
import { productImageUrl } from "@/lib/shop/catalog";

export const metadata: Metadata = { title: "Đơn hàng" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/don-hang">) {
  const query = parseAdminOrderQuery(await searchParams);
  const { rows, total, page, totalPages, counts } = await getAdminOrders(query);
  const from = total ? (page - 1) * ORDER_PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        actions={
          <>
            <a href={`/admin/don-hang/xuat${adminOrderSearch(query, { page: 1 })}`} className={BTN_SECONDARY}>
              Xuất Excel
            </a>
            <Link href="/admin/don-hang/moi" className={BTN_PRIMARY}>
              + Tạo đơn thủ công
            </Link>
          </>
        }
      />

      {/* Viền dưới vẽ bằng shadow inset để gạch chân tab không tràn ra ngoài (tránh hiện thanh cuộn dọc) */}
      <nav
        aria-label="Trạng thái đơn"
        className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden px-4 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {ORDER_TABS.map((t) => {
          const active = query.tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/don-hang${adminOrderSearch(query, { page: 1, tab: t.value })}`}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-3 text-[14px] ${
                active ? "border-terracotta font-medium" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label} <span className={active ? "text-terracotta" : "text-ink"}>{counts[t.value]}</span>
            </Link>
          );
        })}
      </nav>

      <OrderFilters query={query} />

      {/* key: đổi bộ lọc / trang thì bỏ các đơn đang chọn */}
      <OrderTable
        key={adminOrderSearch(query)}
        rows={rows.map((o) => ({
          id: o.id,
          code: o.code,
          status: o.status,
          channel: o.channel,
          payment: o.payment,
          total: o.total,
          createdAt: o.createdAt,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          itemsSummary: o.itemsSummary,
          variantHint: o.variantHint,
          coverUrl: o.coverPath ? productImageUrl(o.coverPath) : null,
          tint: tintFor(o.firstProductId ?? o.id),
        }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          {rows.length
            ? `Hiển thị ${from}–${from + rows.length - 1} trong ${total} đơn`
            : total
              ? `Trang ${page} không có đơn`
              : "Không có đơn"}
        </span>
        <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} pathname="/admin/don-hang" search={adminOrderSearch(query)} />
      </div>
    </>
  );
}
