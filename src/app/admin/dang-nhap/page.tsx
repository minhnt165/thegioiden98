import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { safeAdminPath } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Đăng nhập" };

async function LoginFormWithNext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  return <LoginForm next={safeAdminPath(Array.isArray(next) ? next[0] : next)} />;
}

export default function LoginPage({ searchParams }: PageProps<"/admin/dang-nhap">) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo href="/" />
        <div className="flex flex-col gap-6 rounded-card border border-line bg-white p-6 md:p-7">
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-[26px] font-normal tracking-[-0.01em]">Kênh người bán</h1>
            <p className="text-[13px] text-muted">Đăng nhập để quản lý sản phẩm, đơn hàng và báo giá.</p>
          </div>
          <Suspense fallback={<LoginForm next="/admin" />}>
            <LoginFormWithNext searchParams={searchParams} />
          </Suspense>
        </div>
        <Link href="/" className="text-center text-[13px] text-muted hover:text-terracotta">
          ← Về cửa hàng
        </Link>
      </div>
    </main>
  );
}
