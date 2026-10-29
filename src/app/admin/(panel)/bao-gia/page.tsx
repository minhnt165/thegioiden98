import type { Metadata } from "next";
import Link from "next/link";
import { QuoteRowAction } from "@/components/admin/QuoteActions";
import { QuoteFilters } from "@/components/admin/QuoteFilters";
import { BTN_PRIMARY, Badge, PageHeader, Pagination } from "@/components/admin/ui";
import { QUOTE_PAGE_SIZE, QUOTE_TABS, addDays, adminQuoteSearch, formatDay, parseAdminQuoteQuery } from "@/lib/admin/quote-filters";
import { getAdminQuotes } from "@/lib/admin/quotes";
import { CHANNEL_NAME, QUOTE_STATUS } from "@/lib/admin/status";
import { formatDate, formatVND } from "@/lib/format";

export const metadata: Metadata = { title: "Báo giá" };

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-5 py-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`text-[22px] font-medium md:text-[26px] ${accent ? "text-terracotta" : ""}`}>{value}</span>
    </div>
  );
}

export default async function AdminQuotesPage({ searchParams }: PageProps<"/admin/bao-gia">) {
  const query = parseAdminQuoteQuery(await searchParams);
  const { rows, total, page, totalPages, counts, kpi, today } = await getAdminQuotes(query);
  const from = total ? (page - 1) * QUOTE_PAGE_SIZE + 1 : 0;
  const soon = addDays(today, 2);

  return (
    <>
      <PageHeader
        title="Báo giá"
        subtitle="Lập báo giá cho khách hỏi qua Zalo / Messenger, gửi link, khách bấm đồng ý là thành đơn."
        actions={
          <Link href="/admin/bao-gia/moi" className={BTN_PRIMARY}>
            + Lập báo giá
          </Link>
        }
      />

      <section aria-label="Tình hình báo giá" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi label="Đang chờ khách" value={String(kpi.waiting)} accent />
        <Kpi label="Sắp hết hạn (≤ 2 ngày)" value={String(kpi.expiringSoon)} />
        <Kpi label="Tỉ lệ chốt 30 ngày" value={kpi.winRate === null ? "—" : `${kpi.winRate}%`} />
        <Kpi label="Giá trị đang chờ" value={formatVND(kpi.waitingValue)} />
      </section>

      {/* Viền dưới vẽ bằng shadow inset để gạch chân tab không tràn ra ngoài (tránh hiện thanh cuộn dọc) */}
      <nav
        aria-label="Trạng thái báo giá"
        className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden px-4 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {QUOTE_TABS.map((t) => {
          const active = query.tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/bao-gia${adminQuoteSearch(query, { page: 1, tab: t.value })}`}
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

      <QuoteFilters query={query} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-245 border-collapse text-[14px]">
          <thead>
            <tr className="bg-cream text-left text-[12px] text-muted">
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-2 py-3 font-medium">Khách hàng</th>
              <th className="px-2 py-3 font-medium">Nội dung</th>
              <th className="px-2 py-3 text-right font-medium">Tổng</th>
              <th className="px-2 py-3 font-medium">Hiệu lực đến</th>
              <th className="px-2 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const status = QUOTE_STATUS[q.status];
              const waiting = q.status === "sent" || q.status === "viewed";
              return (
                <tr key={q.id} className="border-t border-line-soft">
                  <td className="px-4 py-3.5">
                    <span className="flex flex-col gap-0.5">
                      <Link href={`/admin/bao-gia/${q.id}`} className="font-medium hover:text-terracotta">
                        {q.code}
                      </Link>
                      <span className="text-[12px] text-muted">{formatDate(q.createdAt)}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="flex flex-col gap-0.5">
                      <span>{q.customerName}</span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                        <span aria-hidden className={`size-2 rounded-full ${CHANNEL_NAME[q.channel].color}`} />
                        {CHANNEL_NAME[q.channel].label}
                      </span>
                    </span>
                  </td>
                  <td className="max-w-80 px-2 py-3.5 text-[13px]">
                    <span className="line-clamp-2">{q.itemsSummary}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5 text-right font-medium">{formatVND(q.total)}</td>
                  <td
                    className={`whitespace-nowrap px-2 py-3.5 text-[13px] ${
                      waiting && q.validUntil && q.validUntil <= soon ? "text-status-amber" : "text-muted"
                    }`}
                  >
                    {formatDay(q.validUntil) || "—"}
                  </td>
                  <td className="px-2 py-3.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <QuoteRowAction
                      quote={{
                        id: q.id,
                        code: q.code,
                        status: q.status,
                        token: q.token,
                        customerName: q.customerName,
                        customerPhone: q.customerPhone,
                        validUntil: q.validUntil,
                        orderId: q.orderId,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-muted">
                  {query.q || query.channel ? "Không có báo giá khớp bộ lọc." : "Chưa có báo giá nào ở mục này."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          {rows.length
            ? `Hiển thị ${from}–${from + rows.length - 1} trong ${total} báo giá`
            : total
              ? `Trang ${page} không có báo giá`
              : "Không có báo giá"}
        </span>
        <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} pathname="/admin/bao-gia" search={adminQuoteSearch(query)} />
      </div>
    </>
  );
}
