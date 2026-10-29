import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { LogoMark } from "@/components/brand/Logo";
import { AdminNav, AdminNavFallback } from "@/components/admin/AdminNav";
import { getCurrentUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

async function SidebarNav() {
  const user = await getCurrentUser();
  let pendingOrders = 0;
  if (user?.role === "admin") {
    const supabase = await createClient();
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending");
    pendingOrders = count ?? 0;
  }
  return <AdminNav pendingOrders={pendingOrders} />;
}

async function SidebarAccount() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="hidden flex-col gap-2 border-t border-cream/15 pt-4 lg:flex">
      <span className="truncate px-1 text-[12px] opacity-70" title={user.email}>
        {user.fullName ?? user.email}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13px] opacity-85 hover:bg-cream/8 hover:opacity-100"
        >
          <LogOut aria-hidden className="size-4" strokeWidth={1.6} />
          Đăng xuất
        </button>
      </form>
    </div>
  );
}

/** Chặn người không phải admin. RLS ở DB vẫn là lớp bảo vệ chính. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/dang-nhap");
  if (user.role !== "admin") {
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-card border border-line bg-white p-6">
        <h1 className="font-serif text-[24px]">Chưa có quyền quản trị</h1>
        <p className="text-[14px] leading-relaxed text-muted">
          Tài khoản <strong className="text-ink">{user.email}</strong> đã đăng nhập nhưng chưa được cấp quyền admin. Nhờ chủ
          shop chạy <code>supabase/snippets/grant-admin.sql</code> với email này.
        </p>
        <form action={signOut}>
          <button type="submit" className="h-10 rounded-input border border-line px-4 text-[14px] hover:border-ink">
            Đăng xuất
          </button>
        </form>
      </div>
    );
  }
  return children;
}

function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="flex flex-col gap-5">
      <div className="h-9 w-56 animate-pulse rounded-input bg-line/60" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white/70" />
    </div>
  );
}

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-ink px-4 py-4 text-cream lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:gap-7 lg:py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" aria-label="Thế Giới Đèn 98 — trang quản trị" className="flex items-center gap-2.5 px-2">
            <LogoMark tone="dark" size={32} />
            <span className="flex flex-col leading-none">
              <span className="font-serif text-[16px]">Thế Giới Đèn</span>
              <span className="mt-1 text-[11px] uppercase tracking-[0.12em] opacity-60">Kênh người bán</span>
            </span>
          </Link>
          <form action={signOut} className="lg:hidden">
            <button type="submit" aria-label="Đăng xuất" className="flex size-10 items-center justify-center rounded-xl hover:bg-cream/10">
              <LogOut aria-hidden className="size-4.5" strokeWidth={1.6} />
            </button>
          </form>
        </div>

        <Suspense fallback={<AdminNavFallback />}>
          <SidebarNav />
        </Suspense>

        <div className="mt-auto hidden flex-col gap-4 lg:flex">
          <Link
            href="/"
            target="_blank"
            className="flex h-11 items-center rounded-xl border border-cream/30 px-3 text-[13px] hover:bg-cream/8"
          >
            Xem cửa hàng →
          </Link>
          <Suspense fallback={null}>
            <SidebarAccount />
          </Suspense>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 md:px-8 md:pt-7">
        <Suspense fallback={<ContentSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
