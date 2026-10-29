import type { Metadata } from "next";
import Link from "next/link";
import { ProductFilters } from "@/components/admin/ProductFilters";
import { ProductTable } from "@/components/admin/ProductTable";
import { BTN_PRIMARY, PageHeader } from "@/components/admin/ui";
import { tintFor } from "@/components/shop/ProductArt";
import { ADMIN_PAGE_SIZE, PRODUCT_TABS, adminProductSearch, parseAdminProductQuery } from "@/lib/admin/product-filters";
import { getAdminProducts } from "@/lib/admin/products";
import { productImageUrl } from "@/lib/shop/catalog";

export const metadata: Metadata = { title: "Sản phẩm" };

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/san-pham">) {
  const query = parseAdminProductQuery(await searchParams);
  const { rows, total, page, totalPages, counts, variantTotal, categories } = await getAdminProducts(query);
  const from = total ? (page - 1) * ADMIN_PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        subtitle={`${counts["tat-ca"]} sản phẩm · ${variantTotal} phân loại`}
        actions={
          <Link href="/admin/san-pham/moi" className={BTN_PRIMARY}>
            + Thêm sản phẩm
          </Link>
        }
      />

      {/* Viền dưới vẽ bằng shadow inset để gạch chân tab không tràn ra ngoài (tránh hiện thanh cuộn dọc) */}
      <nav
        aria-label="Trạng thái sản phẩm"
        className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden px-4 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {PRODUCT_TABS.map((t) => {
          const active = query.tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/san-pham${adminProductSearch({ ...query, page: 1, tab: t.value })}`}
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

      <ProductFilters
        tab={query.tab}
        q={query.q}
        category={query.category}
        stock={query.stock}
        sort={query.sort}
        categories={categories}
      />

      <ProductTable
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          status: r.status,
          categoryName: r.categoryName,
          skuHint: r.skuHint,
          variantSummary: r.variantSummary,
          minPrice: r.minPrice,
          maxPrice: r.maxPrice,
          stock: r.stock,
          threshold: r.threshold,
          sold: r.sold,
          coverUrl: r.coverPath ? productImageUrl(r.coverPath) : null,
          tint: tintFor(r.slug),
        }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>{total ? `Hiển thị ${from}–${from + rows.length - 1} trong ${total} sản phẩm` : "Không có sản phẩm"}</span>
        {totalPages > 1 && (
          <nav aria-label="Phân trang" className="flex gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
              p === page ? (
                <span key={p} aria-current="page" className="inline-flex size-9 items-center justify-center rounded-lg bg-ink text-cream">
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={`/admin/san-pham${adminProductSearch(query, { page: p })}`}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white hover:border-ink"
                >
                  {p}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </>
  );
}
