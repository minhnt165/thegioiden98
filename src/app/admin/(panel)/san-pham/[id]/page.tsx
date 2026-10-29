import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form/ProductForm";
import { getCategoryOptions, getProductForm } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Sửa sản phẩm" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: PageProps<"/admin/san-pham/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [product, categories] = await Promise.all([getProductForm(id), getCategoryOptions()]);
  if (!product) notFound();
  // key: mở sản phẩm khác thì form khởi tạo lại từ đầu
  return <ProductForm key={product.id} initial={product} newId={product.id!} categories={categories} />;
}
