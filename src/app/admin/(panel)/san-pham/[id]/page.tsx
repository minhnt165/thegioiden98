import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { ProductForm } from "@/components/admin/product-form/ProductForm";
import { StockMovementTable } from "@/components/admin/StockMovementTable";
import { Card } from "@/components/admin/ui";
import { getCategoryOptions, getProductForm } from "@/lib/admin/products";
import { getProductStockHistory } from "@/lib/admin/stock";
import { EMPTY_STOCK_QUERY, adminStockSearch } from "@/lib/admin/stock-filters";

export const metadata: Metadata = { title: "Sửa sản phẩm" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditProductPage({ params }: PageProps<"/admin/san-pham/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [product, categories, stockHistory] = await Promise.all([getProductForm(id), getCategoryOptions(), getProductStockHistory(id)]);
  if (!product) notFound();
  return (
    <>
      {/* key: mở sản phẩm khác thì form khởi tạo lại từ đầu */}
      <ProductForm key={product.id} initial={product} newId={product.id!} categories={categories} />
      <Card
        title="Lịch sử kho"
        aside={
          <Link href={`/admin/kho${adminStockSearch(EMPTY_STOCK_QUERY, { tab: "lich-su", productId: id })}`} className="text-[13px] text-terracotta hover:underline">
            Xem tất cả
          </Link>
        }
      >
        <StockMovementTable rows={stockHistory} showProduct={false} empty="Chưa có thay đổi tồn nào." />
      </Card>
    </>
  );
}

export default withContentSkeleton(EditProductPage);
