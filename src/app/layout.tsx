import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

// Tiêu đề: Cormorant Garamond (có chân, tương phản nét cao, có nghiêng) · Nội dung: Manrope
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
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
    <html lang="vi" className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
