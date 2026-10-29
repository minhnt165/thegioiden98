import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000"),
  title: {
    default: "Thế Giới Đèn 98 — Đèn & nội thất decor",
    template: "%s · Thế Giới Đèn 98",
  },
  description:
    "Đèn bàn, đèn sàn, đèn thả, ghế bàn và đồ decor chọn lọc từ xưởng thủ công. Showroom An Khánh, Hà Nội.",
};

export const viewport: Viewport = {
  themeColor: "#F3EFE7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${fraunces.variable} ${beVietnam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
