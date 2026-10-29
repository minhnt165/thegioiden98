import type { Metadata } from "next";
import Link from "next/link";
import { MobileContactBar } from "@/components/shop/MobileContactBar";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { HOME_CATEGORIES } from "@/components/shop/nav";
import { GENERAL_MESSAGE, messengerLink, zaloLink } from "@/lib/shop/contact";
import { getShopSettings } from "@/lib/shop/settings";

export const metadata: Metadata = { title: "Không tìm thấy trang" };

// Trang 404 chung: URL không khớp route nào, hoặc trang cửa hàng gọi notFound().
// Render ngay dưới root layout (không qua layout (shop)) nên tự gắn header/footer.
export default async function NotFound() {
  const settings = await getShopSettings();
  const contactHref = zaloLink(settings.zaloPhone) ?? messengerLink(settings.messengerUrl, GENERAL_MESSAGE);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader settings={settings} />
      <main className="flex flex-1 flex-col">
        <section className="grid flex-1 items-center gap-8 px-5 pb-12 pt-8 md:px-12 md:pb-20 md:pt-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex min-w-0 flex-col gap-4.5 md:gap-6 lg:col-span-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted md:text-[13px]">Lỗi 404</p>
            <h1 className="font-serif text-[40px] font-light leading-[1.05] tracking-[-0.02em] md:text-[64px]">
              Góc này <em className="font-normal italic text-terracotta">chưa lên đèn.</em>
            </h1>
            <p className="max-w-115 text-[15px] leading-relaxed text-muted md:text-[17px]">
              Trang bạn tìm không có hoặc đã được dời đi — có thể sản phẩm đã ngừng bán hay đường dẫn bị gõ nhầm. Bạn quay về
              trang chủ, xem bộ sưu tập, hoặc nhắn shop để được tìm mẫu tương tự.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-cream hover:text-glow md:h-13 md:px-6.5"
              >
                Về trang chủ
              </Link>
              <Link
                href="/san-pham"
                className="inline-flex h-12 items-center rounded-full border border-ink px-6 text-[15px] font-medium hover:bg-ink hover:text-cream md:h-13 md:px-6.5"
              >
                Xem bộ sưu tập
              </Link>
            </div>
            {contactHref && (
              <a href={contactHref} target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4 hover:text-terracotta">
                Nhắn shop tìm giúp →
              </a>
            )}
          </div>

          <div className="flex h-72 min-w-0 items-start justify-center overflow-hidden rounded-[22px] bg-swatch-1 md:h-105 md:rounded-card-lg lg:col-span-6">
            {/* "4 0 4": số 0 là bóng của chiếc đèn thả đang tắt */}
            <svg aria-hidden viewBox="0 0 400 290" className="h-[88%] w-auto max-w-[92%]">
              <path d="M200 0 V72" stroke="#1B1916" strokeWidth="3" />
              <path d="M152 72 H248 L278 150 H122 Z" fill="#1B1916" />
              <ellipse cx="200" cy="212" rx="34" ry="48" fill="none" stroke="#1B1916" strokeWidth="5" />
              <text x="92" y="260" textAnchor="middle" className="fill-ink font-serif text-[150px] font-light">
                4
              </text>
              <text x="308" y="260" textAnchor="middle" className="fill-ink font-serif text-[150px] font-light">
                4
              </text>
            </svg>
          </div>
        </section>

        <nav aria-label="Danh mục" className="flex flex-col gap-3 px-5 pb-12 md:px-12 md:pb-20">
          <h2 className="text-[13px] uppercase tracking-[0.12em] text-muted">Hoặc xem theo danh mục</h2>
          <div className="flex flex-wrap gap-2">
            {HOME_CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/danh-muc/${c.slug}`}
                className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px] hover:border-ink"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </nav>
      </main>
      <SiteFooter settings={settings} />
      <MobileContactBar
        zaloHref={zaloLink(settings.zaloPhone)}
        messengerHref={messengerLink(settings.messengerUrl, GENERAL_MESSAGE)}
      />
    </div>
  );
}
