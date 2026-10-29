import type { Metadata } from "next";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
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

async function NewOrderPage({ searchParams }: PageProps<"/admin/don-hang/moi">) {
  const [{ customers, variants }, { khach }] = await Promise.all([getOrderFormOptions(), searchParams]);
  // Mở từ trang khách hàng: ?khach=<id> điền sẵn khách
  const picked = customers.find((c) => c.id === khach);
  const initial: OrderFormData = picked
    ? {
        ...EMPTY,
        customer: { id: picked.id, name: picked.name, phone: picked.phone ?? "", address: picked.address ?? "" },
        channel: picked.channel,
      }
    : EMPTY;
  return <OrderForm initial={initial} customers={customers} variants={variants} />;
}

export default withContentSkeleton(NewOrderPage);
