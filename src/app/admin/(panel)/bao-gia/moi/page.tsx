import type { Metadata } from "next";
import { QuoteForm } from "@/components/admin/QuoteForm";
import { getOrderFormOptions } from "@/lib/admin/orders";
import { getNewQuoteForm } from "@/lib/admin/quotes";

export const metadata: Metadata = { title: "Lập báo giá" };

export default async function NewQuotePage({ searchParams }: PageProps<"/admin/bao-gia/moi">) {
  const [initial, { customers, variants }, { khach }] = await Promise.all([getNewQuoteForm(), getOrderFormOptions(), searchParams]);
  // Mở từ trang khách hàng: ?khach=<id> điền sẵn khách
  const picked = customers.find((c) => c.id === khach);
  if (picked) {
    initial.customer = { id: picked.id, name: picked.name, phone: picked.phone ?? "", address: picked.address ?? "" };
    initial.channel = picked.channel;
  }
  return <QuoteForm initial={initial} customers={customers} variants={variants} />;
}
