import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton, ProductListing, type Chip, type Crumb } from "@/components/shop/ProductListing";
import { categoryWithDescendants, getCatalog, getCategories, type Category } from "@/lib/shop/catalog";
import { parseFilters, type SearchParamsRecord } from "@/lib/shop/filters";

export async function generateMetadata({ params }: PageProps<"/danh-muc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  if (!category) return { title: "Không tìm thấy danh mục" };
  return { title: category.name, description: category.description ?? undefined };
}

/** Chip: danh mục cha → các danh mục con; danh mục con → anh em cùng cha */
function buildChips(categories: Category[], category: Category): Chip[] {
  const parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  const group = parent ?? category;
  const children = categories.filter((c) => c.parentId === group.id);
  if (!children.length) return [];
  return [
    { href: `/danh-muc/${group.slug}`, label: "Tất cả", active: group.id === category.id },
    ...children.map((c) => ({ href: `/danh-muc/${c.slug}`, label: c.name, active: c.id === category.id })),
  ];
}

async function CategoryProducts({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const [{ slug }, query, catalog, categories] = await Promise.all([params, searchParams, getCatalog(), getCategories()]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const ids = categoryWithDescendants(categories, category.id);
  const parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  const breadcrumbs: Crumb[] = [
    { href: "/", label: "Trang chủ" },
    ...(parent ? [{ href: `/danh-muc/${parent.slug}`, label: parent.name }] : []),
    { label: category.name },
  ];

  return (
    <ProductListing
      basePath={`/danh-muc/${category.slug}`}
      title={category.name}
      description={category.description ?? parent?.description}
      breadcrumbs={breadcrumbs}
      chips={buildChips(categories, category)}
      products={catalog.filter((p) => p.categoryId && ids.has(p.categoryId))}
      filters={parseFilters(query)}
    />
  );
}

export default function CategoryPage({ params, searchParams }: PageProps<"/danh-muc/[slug]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CategoryProducts params={params} searchParams={searchParams} />
    </Suspense>
  );
}
