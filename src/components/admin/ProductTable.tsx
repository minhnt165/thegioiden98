"use client";

import Image from "next/image";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { setProductsStatus } from "@/app/admin/(panel)/san-pham/actions";
import { formatVND } from "@/lib/format";
import { PRODUCT_STATUS } from "@/lib/admin/status";
import type { Enums } from "@/types/database";
import { Badge } from "./ui";

export type ProductTableRow = {
  id: string;
  name: string;
  slug: string;
  status: Enums<"product_status">;
  categoryName: string | null;
  skuHint: string;
  variantSummary: string;
  minPrice: number;
  maxPrice: number;
  stock: number;
  threshold: number;
  sold: number;
  coverUrl: string | null;
  tint: string;
};

type Status = Enums<"product_status">;

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-status-green" : "bg-line"}`}
    >
      <span className={`absolute top-0.75 size-4.5 rounded-full bg-white transition-all ${on ? "left-5.75" : "left-0.75"}`} />
    </button>
  );
}

/** Bảng sản phẩm admin: chọn nhiều, công tắc hiển thị (đang bán ↔ ẩn), menu thao tác. Cuộn ngang trên màn nhỏ. */
export function ProductTable({ rows }: { rows: ProductTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(rows, (state, change: { ids: string[]; status: Status }) =>
    state.map((r) => (change.ids.includes(r.id) ? { ...r, status: change.status } : r)),
  );

  function changeStatus(ids: string[], status: Status) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ ids, status });
      const result = await setProductsStatus(ids, status);
      if (!result.ok) setError(result.error);
      else setSelected(new Set());
    });
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[13px]">
          <span className="mr-2 font-medium">Đã chọn {selected.size}</span>
          <button type="button" disabled={pending} onClick={() => changeStatus([...selected], "active")} className="h-8.5 rounded-lg border border-line px-3 hover:border-ink">
            Đăng bán
          </button>
          <button type="button" disabled={pending} onClick={() => changeStatus([...selected], "hidden")} className="h-8.5 rounded-lg border border-line px-3 hover:border-ink">
            Ẩn khỏi cửa hàng
          </button>
          <button type="button" disabled={pending} onClick={() => changeStatus([...selected], "draft")} className="h-8.5 rounded-lg border border-line px-3 hover:border-ink">
            Chuyển về nháp
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-muted hover:text-ink">
            Bỏ chọn
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-3.5 py-2.5 text-[13px] text-status-red">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-245 border-collapse text-[14px]">
          <thead>
            <tr className="bg-cream text-left text-[12px] text-muted">
              <th className="w-12 px-4 py-3 font-medium">
                <input type="checkbox" aria-label="Chọn tất cả" checked={allChecked} onChange={toggleAll} className="size-4 accent-ink" />
              </th>
              <th className="px-2 py-3 font-medium">Sản phẩm</th>
              <th className="px-2 py-3 font-medium">Danh mục</th>
              <th className="px-2 py-3 font-medium">Phân loại</th>
              <th className="px-2 py-3 text-right font-medium">Giá</th>
              <th className="px-2 py-3 text-right font-medium">Tồn kho</th>
              <th className="px-2 py-3 text-right font-medium">Đã bán</th>
              <th className="px-2 py-3 font-medium">Hiển thị</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {optimistic.map((p) => (
              <tr key={p.id} className="border-t border-line-soft">
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${p.name}`}
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="size-4 accent-ink"
                  />
                </td>
                <td className="px-2 py-3.5">
                  <Link href={`/admin/san-pham/${p.id}`} className="flex items-center gap-3 hover:text-terracotta">
                    <span className={`relative size-12 shrink-0 overflow-hidden rounded-[10px] ${p.tint}`}>
                      {p.coverUrl && <Image src={p.coverUrl} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{p.name}</span>
                      <span className="flex items-center gap-2 text-[12px] text-muted">
                        {p.skuHint && `SKU ${p.skuHint}`}
                        {p.status !== "active" && <Badge tone={PRODUCT_STATUS[p.status].tone}>{PRODUCT_STATUS[p.status].label}</Badge>}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-3.5 text-[13px]">{p.categoryName ?? "—"}</td>
                <td className="px-2 py-3.5 text-[13px] text-muted">{p.variantSummary}</td>
                <td className="whitespace-nowrap px-2 py-3.5 text-right">
                  {p.minPrice === p.maxPrice ? formatVND(p.minPrice) : `${formatVND(p.minPrice)} – ${formatVND(p.maxPrice)}`}
                </td>
                <td
                  className={`px-2 py-3.5 text-right font-medium ${
                    p.stock <= 0 ? "text-status-red" : p.stock <= p.threshold ? "text-status-amber" : ""
                  }`}
                >
                  {p.stock <= 0 ? "Hết" : p.stock}
                </td>
                <td className="px-2 py-3.5 text-right text-muted">{p.sold}</td>
                <td className="px-2 py-3.5">
                  <Toggle
                    on={p.status === "active"}
                    disabled={pending}
                    label={p.status === "active" ? `Ẩn ${p.name}` : `Đăng bán ${p.name}`}
                    onChange={() => changeStatus([p.id], p.status === "active" ? "hidden" : "active")}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <Link
                    href={`/admin/san-pham/${p.id}`}
                    className="inline-flex h-8.5 items-center rounded-lg border border-line bg-white px-3 text-[13px] hover:border-ink"
                  >
                    Sửa
                  </Link>
                  <details className="relative ml-1.5 inline-block">
                    <summary
                      aria-label="Thêm tùy chọn"
                      className="inline-flex size-8.5 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-white hover:border-ink [&::-webkit-details-marker]:hidden"
                    >
                      <MoreHorizontal aria-hidden className="size-4" />
                    </summary>
                    <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-xl border border-line bg-white p-1 text-left text-[13px] shadow-sm">
                      <a href={`/san-pham/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 hover:bg-cream">
                        Xem trên web
                      </a>
                      {p.status !== "draft" && (
                        <button type="button" onClick={() => changeStatus([p.id], "draft")} className="rounded-lg px-3 py-2 text-left hover:bg-cream">
                          Chuyển về nháp
                        </button>
                      )}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {optimistic.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[14px] text-muted">
                  Không có sản phẩm nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
