import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s · Quản trị · Thế Giới Đèn 98" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
