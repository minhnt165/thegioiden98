"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { ADMIN_SORTS, STOCK_FILTERS } from "@/lib/admin/product-filters";
import { SELECT } from "./ui";

type Props = {
  tab: string;
  q: string;
  category: string;
  stock: string;
  sort: string;
  categories: { id: string; label: string }[];
};

/** Thanh lọc danh sách sản phẩm admin: tìm theo tên/SKU, danh mục, mức tồn, sắp xếp (giữ tab hiện tại) */
export function ProductFilters({ tab, q, category, stock, sort, categories }: Props) {
  // Đổi select thì gửi form ngay
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form action="/admin/san-pham" className="flex flex-wrap items-center gap-2.5">
      {tab !== "tat-ca" && <input type="hidden" name="tab" value={tab} />}
      <label className="flex h-10.5 min-w-60 flex-1 items-center gap-2 rounded-input border border-line bg-white px-3.5">
        <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
        <span className="sr-only">Tìm sản phẩm</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Tên sản phẩm, SKU…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      <select name="danh-muc" aria-label="Danh mục" defaultValue={category} onChange={submitOnChange} className={SELECT}>
        <option value="">Mọi danh mục</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <select name="ton" aria-label="Tồn kho" defaultValue={stock} onChange={submitOnChange} className={SELECT}>
        {STOCK_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select name="sap-xep" aria-label="Sắp xếp" defaultValue={sort} onChange={submitOnChange} className={SELECT}>
        {ADMIN_SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </Form>
  );
}
