"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { CHANNEL_FILTERS } from "@/lib/admin/order-filters";
import type { AdminQuoteQuery } from "@/lib/admin/quote-filters";
import { SELECT } from "./ui";

/** Thanh lọc danh sách báo giá: tìm mã/tên/SĐT/sản phẩm, kênh (giữ tab hiện tại) */
export function QuoteFilters({ query }: { query: AdminQuoteQuery }) {
  return (
    <Form action="/admin/bao-gia" className="flex flex-wrap items-center gap-2.5">
      {query.tab !== "tat-ca" && <input type="hidden" name="tab" value={query.tab} />}
      <label className="flex h-10.5 min-w-60 flex-1 items-center gap-2 rounded-input border border-line bg-white px-3.5">
        <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
        <span className="sr-only">Tìm báo giá</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder="Mã báo giá, tên khách, SĐT…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      <select
        name="kenh"
        aria-label="Kênh"
        defaultValue={query.channel}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={SELECT}
      >
        {CHANNEL_FILTERS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </Form>
  );
}
