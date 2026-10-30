import type { Metadata } from "next";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { StockReceiptForm } from "@/components/admin/StockReceiptForm";
import { getVariantOptions } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Tạo phiếu nhập" };

async function NewStockReceiptPage() {
  // Lấy cả sản phẩm nháp / đang ẩn: hàng có thể về trước khi mở bán
  const variants = await getVariantOptions(true);
  return <StockReceiptForm variants={variants} />;
}

export default withContentSkeleton(NewStockReceiptPage);
