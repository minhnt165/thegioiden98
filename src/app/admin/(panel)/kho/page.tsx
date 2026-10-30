import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { StockFilters } from "@/components/admin/StockFilters";
import { StockMovementTable } from "@/components/admin/StockMovementTable";
import { BTN_PRIMARY, PageHeader, Pagination } from "@/components/admin/ui";
import { getProductName, getStockMovements } from "@/lib/admin/stock";
import { STOCK_PAGE_SIZE, adminStockSearch, parseAdminStockQuery, type AdminStockQuery, type StockTab } from "@/lib/admin/stock-filters";

export const metadata: Metadata = { title: "Kho" };

const TABS: { value: StockTab; label: string }[] = [
  { value: "phieu-nhap", label: "Phiếu nhập" },
  { value: "lich-su", label: "Lịch sử" },
];

/** "Hiển thị 1–30 trong 120 dòng" + phân trang */
function ListFooter({ query, count, total, totalPages, unit }: { query: AdminStockQuery; count: number; total: number; totalPages: number; unit: string }) {
  const from = total ? (query.page - 1) * STOCK_PAGE_SIZE + 1 : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span>{count ? `Hiển thị ${from}–${from + count - 1} trong ${total} ${unit}` : total ? `Trang ${query.page} không có ${unit}` : `Không có ${unit}`}</span>
      <Pagination page={Math.min(query.page, totalPages)} totalPages={totalPages} pathname="/admin/kho" search={adminStockSearch(query)} />
    </div>
  );
}

async function HistoryTab({ query }: { query: AdminStockQuery }) {
  const [{ rows, total, totalPages }, productName] = await Promise.all([
    getStockMovements(query),
    query.productId ? getProductName(query.productId) : null,
  ]);
  const filtered = query.q || query.kind || query.productId || query.from || query.to;

  return (
    <>
      <StockFilters query={query} />
      {query.productId && (
        <div className="flex">
          <Link
            href={`/admin/kho${adminStockSearch(query, { productId: "", page: 1 })}`}
            aria-label="Bỏ lọc theo sản phẩm"
            className="inline-flex h-8.5 items-center gap-2 rounded-full border border-ink bg-ink px-3 text-[13px] text-cream"
          >
            Sản phẩm: {productName ?? "đã xóa"}
            <X aria-hidden className="size-3.5" />
          </Link>
        </div>
      )}
      <StockMovementTable rows={rows} showProduct empty={filtered ? "Không có dòng nào khớp bộ lọc." : "Chưa có thay đổi tồn nào."} />
      <ListFooter query={query} count={rows.length} total={total} totalPages={totalPages} unit="dòng" />
    </>
  );
}

async function AdminStockPage({ searchParams }: PageProps<"/admin/kho">) {
  const query = parseAdminStockQuery(await searchParams);

  return (
    <>
      <PageHeader
        title="Kho"
        subtitle="Mọi thay đổi tồn đều được ghi lại: nhập hàng, bán, hủy / trả, điều chỉnh."
        actions={
          <Link href="/admin/kho/nhap/moi" className={BTN_PRIMARY}>
            + Tạo phiếu nhập
          </Link>
        }
      />

      {/* Viền dưới vẽ bằng shadow inset như trang Đơn hàng */}
      <nav aria-label="Mục kho" className="flex gap-1 shadow-[inset_0_-1px_0_var(--color-line)]">
        {TABS.map((t) => {
          const active = query.tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/kho${t.value === "lich-su" ? "?tab=lich-su" : ""}`}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-3 text-[14px] ${
                active ? "border-terracotta font-medium" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {query.tab === "lich-su" ? (
        <HistoryTab query={query} />
      ) : (
        <p className="rounded-2xl border border-line bg-white px-4 py-12 text-center text-[14px] text-muted">Chưa có phiếu nhập.</p>
      )}
    </>
  );
}

export default withContentSkeleton(AdminStockPage);
