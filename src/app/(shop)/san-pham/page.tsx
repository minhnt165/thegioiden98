import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing, type Chip } from "@/components/shop/ProductListing";
import { getCatalog, getCategories } from "@/lib/shop/catalog";
import { SPACES, parseFilters, type SearchParamsRecord } from "@/lib/shop/filters";

export const metadata: Metadata = {
  title: "Tất cả sản phẩm",
  description: "Đèn bàn, đèn sàn, đèn thả, ghế bàn và đồ decor — lọc theo chất liệu, khoảng giá, màu sắc.",
};

async function AllProducts({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const [params, catalog, categories] = await Promise.all([searchParams, getCatalog(), getCategories()]);
  const filters = parseFilters(params);
  const space = SPACES.find((s) => s.value === filters.space);

  const title = filters.q ? `“${filters.q}”` : (space?.label ?? "Tất cả");
  const chips: Chip[] = [
    { href: "/san-pham", label: "Tất cả", active: true },
    ...categories.filter((c) => !c.parentId).map((c) => ({ href: `/danh-muc/${c.slug}`, label: c.name, active: false })),
  ];

  return (
    <ProductListing
      basePath="/san-pham"
      title={title}
      description={filters.q ? "Kết quả tìm kiếm theo tên, chất liệu và danh mục." : (space?.hint ?? null)}
      breadcrumbs={[{ href: "/", label: "Trang chủ" }, { label: filters.q ? "Tìm kiếm" : "Sản phẩm" }]}
      chips={chips}
      products={catalog}
      filters={filters}
    />
  );
}

export default function ProductsPage({ searchParams }: PageProps<"/san-pham">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <AllProducts searchParams={searchParams} />
    </Suspense>
  );
}
