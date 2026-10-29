import type { Metadata } from "next";
import { connection } from "next/server";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { ProductForm } from "@/components/admin/product-form/ProductForm";
import { getCategoryOptions, type ProductFormData } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Thêm sản phẩm" };

const EMPTY: ProductFormData = {
  id: null,
  name: "",
  slug: "",
  categoryId: "",
  description: "",
  material: "",
  dimensions: "",
  bulb: "",
  extraSpecs: [],
  careInstructions: "",
  basePrice: 0,
  compareAtPrice: null,
  status: "draft",
  isFeatured: false,
  badge: "none",
  lowStockThreshold: null,
  materialTags: [],
  colorTags: [],
  spaces: [],
  seoDescription: "",
  options: [],
  variants: [{ id: null, sku: "", price: 0, stock: 0, isActive: true, optionValues: {} }],
  images: [],
  createdAt: null,
  updatedAt: null,
};

async function NewProductPage() {
  // id mới cho mỗi lần mở form: ảnh tải lên trước khi lưu nằm trong thư mục products/<id>/
  await connection();
  const categories = await getCategoryOptions();
  return <ProductForm initial={EMPTY} newId={crypto.randomUUID()} categories={categories} />;
}

export default withContentSkeleton(NewProductPage);
