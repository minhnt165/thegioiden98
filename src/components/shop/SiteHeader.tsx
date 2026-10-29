import Link from "next/link";
import { FaFacebookMessenger } from "react-icons/fa";
import { SiZalo } from "react-icons/si";
import { Logo } from "@/components/brand/Logo";
import { GENERAL_MESSAGE, messengerLink, zaloLink } from "@/lib/shop/contact";
import type { ShopSettings } from "@/lib/shop/settings";
import { MobileMenu } from "./MobileMenu";
import { SearchToggle } from "./SearchToggle";
import { MAIN_NAV } from "./nav";

export function SiteHeader({ settings }: { settings: ShopSettings }) {
  const zalo = zaloLink(settings.zaloPhone);
  const contactHref = zalo ?? messengerLink(settings.messengerUrl, GENERAL_MESSAGE);
  const ContactIcon = zalo ? SiZalo : FaFacebookMessenger;

  return (
    <header className="relative border-b border-line">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-12 md:py-5.5">
        <div className="flex items-center lg:hidden">
          <MobileMenu />
        </div>

        <Logo size="md" className="max-lg:[&_svg]:size-9" />

        <nav aria-label="Danh mục chính" className="hidden flex-wrap gap-x-8 gap-y-2 text-[15px] lg:flex">
          {MAIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="py-2 hover:text-terracotta">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <SearchToggle />
          {contactHref && (
            <a
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden h-11 items-center gap-2 rounded-full px-4.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 lg:inline-flex ${
                zalo ? "bg-zalo" : "bg-messenger"
              }`}
            >
              <ContactIcon aria-hidden className={zalo ? "size-5" : "size-4.5"} />
              {zalo ? "Nhắn Zalo" : "Nhắn Messenger"}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
