import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withContentSkeleton } from "@/components/admin/ContentSkeleton";
import { QuoteForm } from "@/components/admin/QuoteForm";
import { getOrderFormOptions } from "@/lib/admin/orders";
import { parseSavedNotice } from "@/lib/admin/quote-filters";
import { getQuoteForm } from "@/lib/admin/quotes";

export const metadata: Metadata = { title: "Báo giá" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function QuoteDetailPage({ params, searchParams }: PageProps<"/admin/bao-gia/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [quote, { customers, variants }, { xong }] = await Promise.all([getQuoteForm(id), getOrderFormOptions(), searchParams]);
  if (!quote) notFound();
  return <QuoteForm key={quote.id} initial={quote} customers={customers} variants={variants} flash={parseSavedNotice(xong)} />;
}

export default withContentSkeleton(QuoteDetailPage);
