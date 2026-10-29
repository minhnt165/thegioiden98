"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { CHANNEL_FILTERS, PAYMENT_FILTERS, type AdminOrderQuery } from "@/lib/admin/order-filters";
import { SELECT } from "./ui";

/** Thanh lọc danh sách đơn: tìm mã/tên/SĐT, kênh, thanh toán, khoảng ngày (giữ tab hiện tại) */
export function OrderFilters({ query }: { query: AdminOrderQuery }) {
  // Đổi select / ngày thì gửi form ngay
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form action="/admin/don-hang" className="flex flex-wrap items-center gap-2.5">
      {query.tab !== "tat-ca" && <input type="hidden" name="tab" value={query.tab} />}
      <label className="flex h-10.5 min-w-60 flex-1 items-center gap-2 rounded-input border border-line bg-white px-3.5">
        <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
        <span className="sr-only">Tìm đơn hàng</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder="Mã đơn, tên khách, SĐT…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      <select name="kenh" aria-label="Kênh đặt hàng" defaultValue={query.channel} onChange={submitOnChange} className={SELECT}>
        {CHANNEL_FILTERS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select name="thanh-toan" aria-label="Thanh toán" defaultValue={query.payment} onChange={submitOnChange} className={SELECT}>
        {PAYMENT_FILTERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <input type="date" name="tu" aria-label="Từ ngày" defaultValue={query.from} max={query.to || undefined} onChange={submitOnChange} className={SELECT} />
      <input type="date" name="den" aria-label="Đến ngày" defaultValue={query.to} min={query.from || undefined} onChange={submitOnChange} className={SELECT} />
    </Form>
  );
}
