import Link from "next/link";
import type { ReactNode } from "react";
import { TONE_CLASS } from "@/lib/admin/status";

// Khối giao diện dùng chung ở admin (theo design/Admin*.html)

export const BTN_PRIMARY =
  "inline-flex h-10.5 items-center justify-center gap-2 rounded-input bg-ink px-4 text-[14px] font-medium text-cream hover:text-glow disabled:opacity-50";
export const BTN_SECONDARY =
  "inline-flex h-10.5 items-center justify-center gap-2 rounded-input border border-line bg-white px-4 text-[14px] font-medium hover:border-ink disabled:opacity-50";
export const INPUT =
  "h-11 w-full rounded-input border border-line bg-white px-3.5 text-[14px] outline-none focus:border-ink disabled:bg-cream";
export const SELECT = "h-10.5 rounded-input border border-line bg-white px-3 text-[14px]";
export const LABEL = "text-[13px] text-muted";

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: { href: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {breadcrumb && (
          <nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-[13px] text-muted">
            {breadcrumb.map((b, i) => (
              <span key={b.href} className="flex gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={b.href} className="hover:text-terracotta">
                  {b.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-serif text-[26px] font-normal tracking-[-0.01em] md:text-[30px]">{title}</h1>
        {subtitle && <span className="text-[13px] text-muted">{subtitle}</span>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3.5 rounded-2xl border border-line bg-white p-5 ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-medium">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Phân trang rút gọn: 1 … 4 5 6 … 12.
 * Link ghép từ pathname + query hiện tại (chỉ nhận dữ liệu, không nhận hàm — file này cũng được client component import).
 */
export function Pagination({
  page,
  totalPages,
  pathname,
  search,
  param = "trang",
}: {
  page: number;
  totalPages: number;
  pathname: string;
  /** Query hiện tại, có hoặc không có "?" */
  search: string;
  param?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(search);
    if (p > 1) sp.set(param, String(p));
    else sp.delete(param);
    const s = sp.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return (
    <nav aria-label="Phân trang" className="flex gap-1.5">
      {pages.map((p, i) => (
        <span key={p} className="flex gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="inline-flex size-9 items-center justify-center">…</span>}
          {p === page ? (
            <span aria-current="page" className="inline-flex size-9 items-center justify-center rounded-lg bg-ink text-cream">
              {p}
            </span>
          ) : (
            <Link href={href(p)} className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white hover:border-ink">
              {p}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Badge({ tone, children }: { tone: keyof typeof TONE_CLASS; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${TONE_CLASS[tone]}`}>{children}</span>;
}
