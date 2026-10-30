import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { BTN_SECONDARY, Card, PageHeader } from "@/components/admin/ui";
import { getStockReceipt } from "@/lib/admin/stock";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Phiếu nhập" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function StockReceiptPage({ params }: PageProps<"/admin/kho/nhap/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getStockReceipt(id);
  if (!data) notFound();
  const { receipt, items } = data;

  return (
    <>
      <PageHeader
        title={`Phiếu nhập ${receipt.code}`}
        breadcrumb={[{ href: "/admin/kho", label: "Kho" }]}
        subtitle={`Lập ${formatDateTime(receipt.createdAt)}${receipt.actorName ? ` · ${receipt.actorName}` : ""}`}
        actions={
          <Link href="/admin/kho/nhap/moi" className={BTN_SECONDARY}>
            + Tạo phiếu khác
          </Link>
        }
      />

      {receipt.note && (
        <Card title="Ghi chú">
          <p className="whitespace-pre-line text-[14px]">{receipt.note}</p>
        </Card>
      )}

      <Card title="Sản phẩm nhập" aside={<span className="text-[13px] text-muted">{items.length} dòng · tổng {receipt.totalQty}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="px-2 py-2 font-medium">Sản phẩm</th>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="px-2 py-2 text-right font-medium">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.sku} className="border-t border-line-soft">
                  <td className="px-2 py-2.5">
                    {i.productId ? (
                      <Link href={`/admin/san-pham/${i.productId}`} className="hover:text-terracotta">
                        {i.productName}
                      </Link>
                    ) : (
                      i.productName
                    )}
                    {i.variantLabel && <span className="text-muted"> · {i.variantLabel}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-[13px] text-muted">{i.sku}</td>
                  <td className="px-2 py-2.5 text-right font-medium tabular-nums">{i.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[13px] text-muted">
        Phiếu đã lưu không sửa được. Nhập sai thì điều chỉnh tồn ở trang sản phẩm và ghi chú mã {receipt.code}.
      </p>
    </>
  );
}

export default withContentSkeleton(StockReceiptPage);
