"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { STOCK_KIND } from "@/lib/admin/status";
import type { AdminStockQuery } from "@/lib/admin/stock-filters";
import { SELECT } from "./ui";

/** Thanh lọc màn Kho. Tab Phiếu nhập: chỉ tìm. Tab Lịch sử: tìm, loại, khoảng ngày (giữ lọc theo sản phẩm). */
export function StockFilters({ query }: { query: AdminStockQuery }) {
  const history = query.tab === "lich-su";
  // Đổi select / ngày thì gửi form ngay
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form action="/admin/kho" className="flex flex-wrap items-center gap-2.5">
      {history && <input type="hidden" name="tab" value="lich-su" />}
      {history && query.productId && <input type="hidden" name="sp" value={query.productId} />}
      <label className="flex h-10.5 min-w-60 flex-1 items-center gap-2 rounded-input border border-line bg-white px-3.5">
        <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
        <span className="sr-only">{history ? "Tìm trong lịch sử kho" : "Tìm phiếu nhập"}</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder={history ? "Sản phẩm, SKU, mã đơn / phiếu…" : "Mã phiếu, sản phẩm, SKU, ghi chú…"}
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      {history && (
        <>
          <select
            name="loai"
            aria-label="Loại thay đổi"
            defaultValue={query.kind ? STOCK_KIND[query.kind].slug : ""}
            onChange={submitOnChange}
            className={SELECT}
          >
            <option value="">Mọi loại</option>
            {Object.values(STOCK_KIND).map((k) => (
              <option key={k.slug} value={k.slug}>
                {k.label}
              </option>
            ))}
          </select>
          <input type="date" name="tu" aria-label="Từ ngày" defaultValue={query.from} max={query.to || undefined} onChange={submitOnChange} className={SELECT} />
          <input type="date" name="den" aria-label="Đến ngày" defaultValue={query.to} min={query.from || undefined} onChange={submitOnChange} className={SELECT} />
        </>
      )}
    </Form>
  );
}
