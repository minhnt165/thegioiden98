import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { PageHeader } from "@/components/admin/ui";
import { getAdminCategories } from "@/lib/admin/categories";

export const metadata: Metadata = { title: "Danh mục" };

async function Categories() {
  const categories = await getAdminCategories();
  return <CategoryManager categories={categories} />;
}

export default function AdminCategoriesPage() {
  return (
    <>
      <PageHeader title="Danh mục" subtitle="Nhóm sản phẩm trên cửa hàng, tối đa 2 cấp (ví dụ Đèn › Đèn bàn)." />
      <Suspense fallback={<div aria-busy="true" aria-label="Đang tải" className="h-96 animate-pulse rounded-2xl bg-white/70" />}>
        <Categories />
      </Suspense>
    </>
  );
}
