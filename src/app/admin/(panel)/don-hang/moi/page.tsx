import type { Metadata } from "next";
import { OrderForm } from "@/components/admin/OrderForm";
import { getOrderFormOptions, type OrderFormData } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Tạo đơn thủ công" };

const EMPTY: OrderFormData = {
  id: null,
  code: null,
  customer: { id: null, name: "", phone: "", address: "" },
  channel: "zalo",
  payment: "cod",
  discount: 0,
  shippingFee: 0,
  note: "",
  items: [],
  reserved: {},
};

export default async function NewOrderPage() {
  const { customers, variants } = await getOrderFormOptions();
  return <OrderForm initial={EMPTY} customers={customers} variants={variants} />;
}
