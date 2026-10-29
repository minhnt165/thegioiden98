import type { Metadata } from "next";
import { QuoteForm } from "@/components/admin/QuoteForm";
import { getOrderFormOptions } from "@/lib/admin/orders";
import { getNewQuoteForm } from "@/lib/admin/quotes";

export const metadata: Metadata = { title: "Lập báo giá" };

export default async function NewQuotePage() {
  const [initial, { customers, variants }] = await Promise.all([getNewQuoteForm(), getOrderFormOptions()]);
  return <QuoteForm initial={initial} customers={customers} variants={variants} />;
}
