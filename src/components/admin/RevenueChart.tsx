"use client";

import { useState } from "react";
import { formatVND } from "@/lib/format";

type Day = { key: string; label: string; revenue: number; orders: number; isToday: boolean };

/** 11200000 → "11,2tr" · 850000 → "850k" */
export function compactVND(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

const W = 560;
const H = 220;
const BASE = 180; // đường đáy
const TOP = 24; // chừa chỗ cho nhãn giá trị
const BAR_MAX = 44;
const RADIUS = 4;

/** Cột bo 4px ở đầu, vuông ở đáy */
function barPath(x: number, w: number, h: number) {
  const r = Math.min(RADIUS, h, w / 2);
  const y = BASE - h;
  return `M${x},${BASE} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${BASE} Z`;
}

/**
 * Biểu đồ cột doanh thu theo ngày (một chuỗi, không cần chú thích).
 * Cột hôm nay màu đất nung như mockup; rê chuột/chạm vào cột để xem số; bảng ẩn cho trình đọc màn hình.
 */
export function RevenueChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const band = W / days.length;
  const barW = Math.min(BAR_MAX, Math.max(band - 4, 2));
  const peak = days.reduce((best, d, i) => (d.revenue > days[best].revenue ? i : best), 0);
  const showEvery = days.length > 10 ? 5 : 1;
  const focus = active ?? null;

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={`Biểu đồ cột doanh thu ${days.length} ngày`}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y"
        onMouseLeave={() => setActive(null)}
      >
        <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="#DCD5C7" strokeWidth="1" />
        {days.map((d, i) => {
          const h = d.revenue > 0 ? Math.max(((BASE - TOP) * d.revenue) / max, 3) : 0;
          const x = i * band + (band - barW) / 2;
          const highlighted = d.isToday || focus === i;
          const showValue = d.revenue > 0 && (i === focus || (focus === null && (d.isToday || i === peak)));
          return (
            <g key={d.key}>
              {h > 0 && <path d={barPath(x, barW, h)} fill={d.isToday ? "#B8612A" : highlighted ? "#B5AC9B" : "#DAD7D0"} />}
              {showValue && (
                <text x={x + barW / 2} y={BASE - h - 8} textAnchor="middle" fontSize="12" fill="#1B1916">
                  {compactVND(d.revenue)}
                </text>
              )}
              {(i % showEvery === 0 || d.isToday) && (
                <text x={i * band + band / 2} y={BASE + 24} textAnchor="middle" fontSize="12" fill="#5E5952">
                  {d.label}
                </text>
              )}
              {/* Vùng chạm rộng hơn cột */}
              <rect
                x={i * band}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i === active ? null : i)}
                tabIndex={0}
                aria-label={`${d.label}: ${formatVND(d.revenue)}, ${d.orders} đơn`}
                className="cursor-default outline-none"
              />
            </g>
          );
        })}
      </svg>

      {focus !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-input border border-line bg-white px-3 py-2 text-[12px] shadow-sm"
          style={{
            left: `${((focus + 0.5) / days.length) * 100}%`,
            transform: `translateX(${focus > days.length / 2 ? "-100%" : "0"})`,
          }}
        >
          <div className="text-muted">{days[focus].isToday ? "Hôm nay" : days[focus].key.split("-").reverse().join("/")}</div>
          <div className="text-[14px] font-medium text-ink">{formatVND(days[focus].revenue)}</div>
          <div className="text-muted">{days[focus].orders} đơn</div>
        </div>
      )}

      <table className="sr-only">
        <caption>Doanh thu theo ngày</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Doanh thu</th>
            <th>Số đơn</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <td>{d.key.split("-").reverse().join("/")}</td>
              <td>{formatVND(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
