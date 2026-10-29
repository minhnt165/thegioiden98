import { FaFacebookMessenger } from "react-icons/fa";
import { SiZalo } from "react-icons/si";

type Props = { zaloHref: string | null; messengerHref: string | null };

/**
 * Thanh liên hệ cố định ở đáy màn hình điện thoại (theo design/MobileHome.html).
 * Trang chi tiết sản phẩm có thanh đặt hàng riêng (data-order-bar) nên thanh này tự ẩn bằng CSS.
 */
export function MobileContactBar({ zaloHref, messengerHref }: Props) {
  if (!zaloHref && !messengerHref) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-line bg-cream px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 md:hidden [body:has([data-order-bar])_&]:hidden">
      {zaloHref && (
        <a
          href={zaloHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12.5 flex-1 items-center justify-center gap-2 rounded-full bg-zalo text-[15px] font-medium text-white"
        >
          <SiZalo aria-hidden className="size-5" />
          Nhắn Zalo
        </a>
      )}
      {messengerHref && (
        <a
          href={messengerHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nhắn Messenger"
          className={`flex h-12.5 items-center justify-center gap-2 rounded-full bg-messenger text-[15px] font-medium text-white ${zaloHref ? "w-12.5" : "flex-1"}`}
        >
          <FaFacebookMessenger aria-hidden className="size-5" />
          {!zaloHref && "Nhắn Messenger"}
        </a>
      )}
    </div>
  );
}
