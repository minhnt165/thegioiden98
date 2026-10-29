import Link from "next/link";
import type { CatalogProduct } from "@/lib/shop/catalog";
import { applyFilters, filtersToSearch, paginate, type ListingFilters } from "@/lib/shop/filters";
import { FilterPanel, SortSelect } from "./FilterPanel";
import { ProductCard } from "./ProductCard";

export type Crumb = { href?: string; label: string };
export type Chip = { href: string; label: string; active: boolean };

type Props = {
  basePath: string;
  title: string;
  description?: string | null;
  breadcrumbs: Crumb[];
  chips: Chip[];
  products: CatalogProduct[];
  filters: ListingFilters;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-[13px] text-muted">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex gap-2">
          {i > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-terracotta">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-ink">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Pagination({ basePath, filters, page, totalPages }: { basePath: string; filters: ListingFilters; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => `${basePath}${filtersToSearch({ ...filters, page: p })}`;
  const cell = "inline-flex size-11 items-center justify-center rounded-full text-[14px]";

  return (
    <nav aria-label="Phân trang" className="flex justify-center gap-2 pt-6">
      {page > 1 && (
        <Link href={href(page - 1)} aria-label="Trang trước" className={`${cell} border border-line bg-white`}>
          ←
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
        p === page ? (
          <span key={p} aria-current="page" className={`${cell} bg-ink text-cream`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={href(p)} className={`${cell} border border-line bg-white hover:border-ink`}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} aria-label="Trang sau" className={`${cell} border border-line bg-white`}>
          →
        </Link>
      )}
    </nav>
  );
}

/** Trang danh sách (dùng cho /san-pham và /danh-muc/[slug]), bố cục theo design/Products.html */
export function ProductListing({ basePath, title, description, breadcrumbs, chips, products, filters }: Props) {
  const filtered = applyFilters(products, filters);
  const { items, page, totalPages, total, from, to } = paginate(filtered, filters.page);

  return (
    <>
      <section className="flex flex-col gap-5 px-5 pb-6 pt-7 md:px-12 md:pb-8 md:pt-10">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-[40px] font-light leading-none tracking-[-0.02em] md:text-[64px]">
            {title} <em className="whitespace-nowrap text-[0.6em] italic text-terracotta md:text-[1em]">— {total} sản phẩm</em>
          </h1>
          {description && <p className="max-w-105 text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {chips.length > 0 && (
          <nav aria-label="Danh mục con" className="-mx-5 mt-1 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {chips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                aria-current={chip.active ? "page" : undefined}
                className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] ${
                  chip.active ? "bg-ink text-cream" : "border border-line bg-white hover:border-ink"
                }`}
              >
                {chip.label}
              </Link>
            ))}
          </nav>
        )}
      </section>

      <section className="flex flex-col gap-6 px-5 md:px-12 lg:flex-row lg:items-start lg:gap-10">
        <FilterPanel basePath={basePath} filters={filters} />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[14px] text-muted">
              {total ? `Hiển thị ${from}–${to} trong ${total} sản phẩm` : "Không có sản phẩm phù hợp"}
            </span>
            <SortSelect basePath={basePath} filters={filters} />
          </div>

          {items.length ? (
            <ul className="grid grid-cols-2 gap-x-3.5 gap-y-8 md:gap-6 xl:grid-cols-3">
              {items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 50vw" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-card border border-line bg-white p-6 md:p-8">
              <p className="text-[15px] leading-relaxed text-muted">
                Chưa có món nào khớp bộ lọc. Bạn thử bỏ bớt điều kiện, hoặc nhắn shop để được tư vấn mẫu tương tự.
              </p>
              <Link
                href={basePath}
                className="inline-flex h-11 items-center rounded-full border border-ink px-5 text-[14px] font-medium hover:bg-ink hover:text-cream"
              >
                Xóa bộ lọc
              </Link>
            </div>
          )}

          <Pagination basePath={basePath} filters={filters} page={page} totalPages={totalPages} />
        </div>
      </section>
    </>
  );
}

export function ListingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải sản phẩm" className="flex flex-col gap-6 px-5 pt-7 md:px-12 md:pt-10">
      <div className="h-4 w-40 animate-pulse rounded-full bg-line/60" />
      <div className="h-12 w-72 animate-pulse rounded-full bg-line/60 md:h-16" />
      <div className="grid grid-cols-2 gap-3.5 md:gap-6 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-4/5 animate-pulse rounded-card bg-line/50" />
        ))}
      </div>
    </div>
  );
}
