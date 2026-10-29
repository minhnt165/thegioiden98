import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrderForm } from "@/components/admin/OrderForm";
import { getOrderForm, getOrderFormOptions } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Sửa đơn" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditOrderPage({ params }: PageProps<"/admin/don-hang/[id]/sua">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [order, { customers, variants }] = await Promise.all([getOrderForm(id), getOrderFormOptions()]);
  if (!order) notFound();
  // Đơn đã xác nhận thì kho / phiếu giao đã chạy theo nội dung cũ: không cho sửa
  if (order.status !== "pending") redirect(`/admin/don-hang/${id}`);
  return <OrderForm key={order.id} initial={order} customers={customers} variants={variants} />;
}
