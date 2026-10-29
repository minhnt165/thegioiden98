import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { ShopSettings } from "@/lib/shop/settings";
import { ContactButtons } from "./ContactButtons";
import { NewsletterForm } from "./NewsletterForm";
import { HOME_CATEGORIES } from "./nav";

const SUPPORT_LINKS = [
  { href: "/#dat-hang", label: "Cách đặt hàng" },
  { href: "/#lien-he", label: "Giao hàng" },
  { href: "/#lien-he", label: "Đổi trả & bảo hành" },
  { href: "/#lien-he", label: "Câu hỏi thường gặp" },
];

const COLUMN_TITLE = "text-[12px] uppercase tracking-[0.12em] text-muted";

export function SiteFooter({ settings }: { settings: ShopSettings }) {
  return (
    <footer
      id="lien-he"
      className="mt-16 flex flex-col gap-10 border-t border-line px-5 pb-28 pt-12 md:mt-20 md:gap-12 md:px-12 md:pb-10 md:pt-16"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-12 lg:gap-8">
        <div className="col-span-2 flex min-w-0 flex-col gap-4 lg:col-span-5">
          <Logo size="md" href={null} className="[&_svg]:size-14" />
          <p className="max-w-90 text-[15px] leading-relaxed text-muted">
            Đèn &amp; nội thất decor chọn lọc. Showroom: {settings.address}. Mở cửa {settings.openingHours} hằng ngày.
          </p>
          <div className="mt-2 empty:hidden">
            <ContactButtons settings={settings} />
          </div>
        </div>

        <nav aria-label="Sản phẩm" className="flex flex-col gap-3 text-[14px] lg:col-span-2">
          <span className={COLUMN_TITLE}>Sản phẩm</span>
          {HOME_CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/danh-muc/${c.slug}`} className="hover:text-terracotta">
              {c.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Hỗ trợ" className="flex flex-col gap-3 text-[14px] lg:col-span-2">
          <span className={COLUMN_TITLE}>Hỗ trợ</span>
          {SUPPORT_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-terracotta">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="col-span-2 flex flex-col gap-3 lg:col-span-3">
          <span className={COLUMN_TITLE}>Nhận tin mới</span>
          <NewsletterForm />
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3 text-[13px] text-muted">
        <span>© 2026 {settings.shopName}. Mọi quyền được bảo lưu.</span>
        <span>Thiết kế &amp; vận hành tại Việt Nam</span>
      </div>
    </footer>
  );
}
