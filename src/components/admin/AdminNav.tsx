"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutGrid, Package, Settings, ShoppingBag, Users, type LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean; exact?: boolean };

// Menu quản trị. Mục "soon" là màn hình của giai đoạn sau, chưa bấm được.
const NAV: NavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutGrid, exact: true },
  { href: "/admin/don-hang", label: "Đơn hàng", icon: ShoppingBag },
  { href: "/admin/bao-gia", label: "Báo giá", icon: FileText },
  { href: "/admin/san-pham", label: "Sản phẩm", icon: Package },
  { href: "/admin/khach-hang", label: "Khách hàng", icon: Users, soon: true },
  { href: "/admin/cai-dat", label: "Cài đặt", icon: Settings },
];

const ITEM =
  "flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-[14px] text-cream lg:shrink";

function NavList({
  isActive,
  pendingOrders,
  waitingQuotes,
}: {
  isActive: (item: NavItem) => boolean;
  pendingOrders?: number;
  waitingQuotes?: number;
}) {
  return (
    <nav aria-label="Menu quản trị" className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => {
        const Icon = item.icon;
        const badge = item.href === "/admin/don-hang" && pendingOrders ? pendingOrders : null;
        if (item.soon) {
          return (
            <span key={item.href} title="Có ở giai đoạn sau" className={`${ITEM} cursor-not-allowed opacity-40`}>
              <Icon aria-hidden className="size-4.5" strokeWidth={1.6} />
              {item.label}
              {badge && <span className="ml-auto rounded-full bg-terracotta px-1.5 text-[11px]">{badge}</span>}
            </span>
          );
        }
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${ITEM} ${active ? "bg-cream/12 font-medium" : "opacity-85 hover:bg-cream/8 hover:opacity-100"}`}
          >
            <Icon aria-hidden className="size-4.5" strokeWidth={1.6} />
            {item.label}
            {badge && (
              <span className="ml-auto inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[12px] text-white">
                {badge}
                <span className="sr-only"> đơn chờ xác nhận</span>
              </span>
            )}
            {item.href === "/admin/bao-gia" && waitingQuotes ? (
              <span className="ml-auto inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-cream/20 px-1.5 text-[12px]">
                {waitingQuotes}
                <span className="sr-only"> báo giá đang chờ khách</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNav({ pendingOrders, waitingQuotes }: { pendingOrders?: number; waitingQuotes?: number }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <NavList isActive={isActive} pendingOrders={pendingOrders} waitingQuotes={waitingQuotes} />;
}

/** Bản không đánh dấu mục đang chọn, hiện trong lúc chờ (prerender) */
export function AdminNavFallback() {
  return <NavList isActive={() => false} />;
}
