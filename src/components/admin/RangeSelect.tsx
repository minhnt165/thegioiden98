"use client";

import { useRouter } from "next/navigation";

/** Chọn khoảng thời gian biểu đồ (?khoang=7|30) */
export function RangeSelect({ value }: { value: 7 | 30 }) {
  const router = useRouter();
  return (
    <select
      aria-label="Khoảng thời gian"
      value={value}
      onChange={(e) => router.replace(e.target.value === "30" ? "/admin?khoang=30" : "/admin", { scroll: false })}
      className="h-9 rounded-lg border border-line bg-white px-3 text-[13px]"
    >
      <option value={7}>7 ngày qua</option>
      <option value={30}>30 ngày qua</option>
    </select>
  );
}
