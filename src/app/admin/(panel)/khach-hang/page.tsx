import type { Metadata } from "next";
import Link from "next/link";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { CustomerFilters } from "@/components/admin/CustomerFilters";
import { BTN_PRIMARY, PageHeader, Pagination } from "@/components/admin/ui";
import { CUSTOMER_PAGE_SIZE, adminCustomerSearch, parseAdminCustomerQuery } from "@/lib/admin/customer-filters";
import { getAdminCustomers } from "@/lib/admin/customers";
import { CHANNEL_NAME } from "@/lib/admin/status";
import { formatDate, formatVND } from "@/lib/format";

export const metadata: Metadata = { title: "Khách hàng" };

async function AdminCustomersPage({ searchParams }: PageProps<"/admin/khach-hang">) {
  const query = parseAdminCustomerQuery(await searchParams);
  const { rows, total, page, totalPages } = await getAdminCustomers(query);
  const from = total ? (page - 1) * CUSTOMER_PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader
        title="Khách hàng"
        subtitle="Khách được lưu khi tạo đơn hoặc lập báo giá; SĐT trùng thì gộp vào cùng một khách."
        actions={
          <Link href="/admin/khach-hang/moi" className={BTN_PRIMARY}>
            + Thêm khách
          </Link>
        }
      />

      <CustomerFilters query={query} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-225 border-collapse text-[14px]">
          <thead>
            <tr className="bg-cream text-left text-[12px] text-muted">
              <th className="px-4 py-3 font-medium">Khách hàng</th>
              <th className="px-2 py-3 font-medium">Kênh</th>
              <th className="px-2 py-3 font-medium">Địa chỉ</th>
              <th className="px-2 py-3 text-right font-medium">Đơn</th>
              <th className="px-2 py-3 text-right font-medium">Tổng chi tiêu</th>
              <th className="px-2 py-3 font-medium">Đơn gần nhất</th>
              <th className="px-4 py-3 font-medium">Báo giá đang mở</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line-soft">
                <td className="px-4 py-3.5">
                  <span className="flex flex-col gap-0.5">
                    <Link href={`/admin/khach-hang/${c.id}`} className="font-medium hover:text-terracotta">
                      {c.name}
                    </Link>
                    <span className="text-[12px] text-muted">{c.phone || "Chưa có SĐT"}</span>
                  </span>
                </td>
                <td className="px-2 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <span aria-hidden className={`size-2 rounded-full ${CHANNEL_NAME[c.channel].color}`} />
                    {CHANNEL_NAME[c.channel].label}
                  </span>
                </td>
                <td className="max-w-72 px-2 py-3.5 text-[13px] text-muted">
                  <span className="line-clamp-2">{c.address || "—"}</span>
                </td>
                <td className="px-2 py-3.5 text-right">{c.orderCount}</td>
                <td className="whitespace-nowrap px-2 py-3.5 text-right font-medium">{c.totalSpent ? formatVND(c.totalSpent) : "—"}</td>
                <td className="whitespace-nowrap px-2 py-3.5 text-[13px] text-muted">{formatDate(c.lastOrderAt) || "Chưa mua"}</td>
                <td className="px-4 py-3.5 text-[13px]">
                  {c.openQuoteCount ? (
                    <span className="text-terracotta">{c.openQuoteCount} báo giá</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-muted">
                  {query.q || query.channel ? "Không có khách khớp bộ lọc." : "Chưa có khách hàng nào."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          {rows.length
            ? `Hiển thị ${from}–${from + rows.length - 1} trong ${total} khách`
            : total
              ? `Trang ${page} không có khách`
              : "Không có khách"}
        </span>
        <Pagination
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          pathname="/admin/khach-hang"
          search={adminCustomerSearch(query)}
        />
      </div>
    </>
  );
}

export default withContentSkeleton(AdminCustomersPage);
