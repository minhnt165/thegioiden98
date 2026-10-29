"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import {
  AVAILABILITY,
  COLORS,
  MATERIALS,
  PRICE_RANGES,
  SORTS,
  filtersToSearch,
  hasActiveFilters,
  type ListingFilters,
} from "@/lib/shop/filters";

type Props = { basePath: string; filters: ListingFilters };

const GROUP_TITLE = "text-[12px] uppercase tracking-[0.12em] text-muted";
const OPTION = "flex min-h-8 cursor-pointer items-center gap-2.5 text-[15px]";
const CHECK = "size-4.5 accent-ink";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Đổi URL theo bộ lọc mới; giao diện cập nhật ngay (optimistic) trong lúc chờ server */
function useNavigateFilters(basePath: string, current: ListingFilters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current);
  const navigate = (next: ListingFilters) =>
    startTransition(() => {
      setOptimistic(next);
      router.push(`${basePath}${filtersToSearch(next)}`, { scroll: false });
    });
  return { navigate, pending, filters: optimistic };
}

function FilterGroups({ basePath, filters: current }: Props) {
  const { navigate, pending, filters } = useNavigateFilters(basePath, current);
  // Đổi bộ lọc thì quay về trang 1
  const update = (patch: Partial<ListingFilters>) => navigate({ ...filters, ...patch, page: 1 });

  return (
    <div className={`flex flex-col gap-7 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <fieldset className="flex flex-col gap-3">
        <legend className={`${GROUP_TITLE} mb-3`}>Chất liệu</legend>
        {MATERIALS.map((m) => (
          <label key={m.value} className={OPTION}>
            <input
              type="checkbox"
              className={CHECK}
              checked={filters.materials.includes(m.value)}
              onChange={() => update({ materials: toggle(filters.materials, m.value) })}
            />
            {m.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${GROUP_TITLE} mb-3`}>Khoảng giá</legend>
        {PRICE_RANGES.map((r) => (
          <label key={r.value} className={OPTION}>
            <input
              type="radio"
              name="gia"
              className={CHECK}
              checked={filters.price === r.value}
              // Bấm lại vào lựa chọn đang chọn để bỏ chọn
              onClick={() => filters.price === r.value && update({ price: null })}
              onChange={() => update({ price: r.value })}
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${GROUP_TITLE} mb-3`}>Màu sắc</legend>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map((c) => {
            const active = filters.colors.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-label={c.label}
                aria-pressed={active}
                title={c.label.replace("Màu ", "")}
                onClick={() => update({ colors: toggle(filters.colors, c.value) })}
                style={{ background: c.hex }}
                className={`size-8 rounded-full border-2 border-cream ${active ? "outline-2 outline-ink" : "outline-1 outline-line"}`}
              />
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${GROUP_TITLE} mb-3`}>Tình trạng</legend>
        {AVAILABILITY.map((a) => (
          <label key={a.value} className={OPTION}>
            <input
              type="checkbox"
              className={CHECK}
              checked={filters.availability.includes(a.value)}
              onChange={() => update({ availability: toggle(filters.availability, a.value) })}
            />
            {a.value === "dat-truoc" ? "Đặt trước (2–3 tuần)" : a.label}
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        disabled={!hasActiveFilters(filters)}
        onClick={() =>
          navigate({ ...filters, materials: [], colors: [], price: null, availability: [], space: null, q: "", page: 1 })
        }
        className="h-11 rounded-full border border-ink text-[14px] font-medium hover:bg-ink hover:text-cream disabled:pointer-events-none disabled:opacity-40"
      >
        Xóa bộ lọc
      </button>
    </div>
  );
}

/** Bộ lọc: cột trái trên desktop, gói gọn trong nút "Bộ lọc" trên điện thoại */
export function FilterPanel({ basePath, filters }: Props) {
  const count =
    filters.materials.length + filters.colors.length + filters.availability.length + (filters.price ? 1 : 0);

  return (
    <>
      <aside aria-label="Bộ lọc" className="hidden w-60 shrink-0 lg:block">
        <FilterGroups basePath={basePath} filters={filters} />
      </aside>
      <details className="group rounded-card border border-line bg-white lg:hidden">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden className="size-4.5" strokeWidth={1.6} />
            Bộ lọc{count ? ` (${count})` : ""}
          </span>
          <span className="text-[13px] font-normal text-muted group-open:hidden">Mở</span>
          <span className="hidden text-[13px] font-normal text-muted group-open:inline">Đóng</span>
        </summary>
        <div className="border-t border-line px-5 py-5">
          <FilterGroups basePath={basePath} filters={filters} />
        </div>
      </details>
    </>
  );
}

export function SortSelect({ basePath, filters: current }: Props) {
  const { navigate, pending, filters } = useNavigateFilters(basePath, current);
  return (
    <label className="flex items-center gap-2.5 text-[14px] text-muted">
      Sắp xếp
      <select
        value={filters.sort}
        disabled={pending}
        onChange={(e) => navigate({ ...filters, sort: e.target.value as ListingFilters["sort"], page: 1 })}
        className="h-10 rounded-full border border-line bg-white px-3.5 text-[14px] text-ink"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
