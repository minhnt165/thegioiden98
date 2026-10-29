"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { CUSTOMER_SORTS, type AdminCustomerQuery } from "@/lib/admin/customer-filters";
import { CHANNEL_FILTERS } from "@/lib/admin/order-filters";
import { SELECT } from "./ui";

/** Thanh lọc danh sách khách: tìm tên/SĐT/địa chỉ, kênh, sắp xếp */
export function CustomerFilters({ query }: { query: AdminCustomerQuery }) {
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form action="/admin/khach-hang" className="flex flex-wrap items-center gap-2.5">
      <label className="flex h-10.5 min-w-60 flex-1 items-center gap-2 rounded-input border border-line bg-white px-3.5">
        <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
        <span className="sr-only">Tìm khách hàng</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder="Tên khách, SĐT, địa chỉ…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      <select name="kenh" aria-label="Kênh" defaultValue={query.channel} onChange={submitOnChange} className={SELECT}>
        {CHANNEL_FILTERS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select name="sap-xep" aria-label="Sắp xếp" defaultValue={query.sort} onChange={submitOnChange} className={SELECT}>
        {CUSTOMER_SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </Form>
  );
}
