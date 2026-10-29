import { FaFacebookMessenger, FaInstagram } from "react-icons/fa";
import { SiZalo } from "react-icons/si";
import { GENERAL_MESSAGE, instagramLink, messengerLink, zaloLink } from "@/lib/shop/contact";
import type { ShopSettings } from "@/lib/shop/settings";

const PILL = "inline-flex h-11 items-center gap-2 rounded-full px-4.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90";

/** Nút Zalo / Messenger / Instagram (footer). Kênh nào chưa cấu hình trong settings thì ẩn. */
export function ContactButtons({ settings }: { settings: ShopSettings }) {
  const zalo = zaloLink(settings.zaloPhone);
  const messenger = messengerLink(settings.messengerUrl, GENERAL_MESSAGE);
  const instagram = instagramLink(settings.instagramUrl);

  if (!zalo && !messenger && !instagram) {
    return <p className="text-[14px] text-muted">Ghé showroom {settings.address} · {settings.openingHours}.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {zalo && (
        <a href={zalo} target="_blank" rel="noopener noreferrer" className={`${PILL} bg-zalo`}>
          <SiZalo aria-hidden className="size-5" />
          Zalo
        </a>
      )}
      {messenger && (
        <a href={messenger} target="_blank" rel="noopener noreferrer" className={`${PILL} bg-messenger`}>
          <FaFacebookMessenger aria-hidden className="size-4.5" />
          Messenger
        </a>
      )}
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" className={`${PILL} bg-instagram`}>
          <FaInstagram aria-hidden className="size-4.5" />
          Instagram
        </a>
      )}
    </div>
  );
}
