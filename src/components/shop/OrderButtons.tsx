"use client";

import { useState } from "react";
import { FaFacebookMessenger } from "react-icons/fa";
import { SiZalo } from "react-icons/si";
import { messengerLink, zaloLink } from "@/lib/shop/contact";

type Props = {
  message: string;
  zaloPhone: string;
  messengerUrl: string;
  disabled?: boolean;
  /** "stack": 2 nút to xếp dọc (trang SP) · "bar": 2 nút ngang (thanh dưới mobile) */
  layout?: "stack" | "bar";
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Nút đặt hàng qua Zalo / Messenger. Zalo không nhận nội dung qua link nên tin nhắn được
 * chép vào clipboard trước khi mở; Messenger điền sẵn qua ?text= và cũng chép để chắc chắn.
 */
export function OrderButtons({ message, zaloPhone, messengerUrl, disabled = false, layout = "stack" }: Props) {
  const [copied, setCopied] = useState<"zalo" | "messenger" | null>(null);
  const zalo = zaloLink(zaloPhone);
  const messenger = messengerLink(messengerUrl, message);
  const bar = layout === "bar";

  if (!zalo && !messenger) return null;

  const base = bar
    ? "flex h-12.5 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white"
    : "flex h-14 items-center justify-center gap-2.5 rounded-full text-[16px] font-medium text-white";
  const state = disabled ? "pointer-events-none opacity-40" : "transition-opacity hover:opacity-90";

  async function handleClick(channel: "zalo" | "messenger") {
    const ok = await copyText(message);
    setCopied(ok ? channel : null);
  }

  return (
    <div className={bar ? "flex flex-col gap-1.5" : "flex flex-col gap-2.5"}>
      <div className={bar ? "flex gap-2.5" : "flex flex-col gap-2.5"}>
        {zalo && (
          <a
            href={zalo}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
            onClick={() => handleClick("zalo")}
            className={`${base} ${state} bg-zalo`}
          >
            <SiZalo aria-hidden className={bar ? "size-5" : "size-6"} />
            {bar ? "Đặt qua Zalo" : "Đặt hàng qua Zalo"}
          </a>
        )}
        {messenger && (
          <a
            href={messenger}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
            onClick={() => handleClick("messenger")}
            className={`${base} ${state} bg-messenger`}
          >
            <FaFacebookMessenger aria-hidden className={bar ? "size-4.5" : "size-5"} />
            {bar ? "Messenger" : "Nhắn Messenger"}
          </a>
        )}
      </div>
      <p role="status" className={`text-center text-muted ${bar ? "text-[12px]" : "text-[13px] leading-normal"}`}>
        {copied === "zalo"
          ? "Đã chép tin nhắn — dán vào khung chat Zalo để gửi cho shop."
          : copied === "messenger"
            ? "Đã chép tin nhắn — nếu Messenger chưa điền sẵn, hãy dán vào khung chat."
            : bar
              ? null
              : "Tin nhắn sẽ có sẵn tên sản phẩm và phân loại bạn đã chọn. Shop phản hồi trong giờ làm việc."}
      </p>
    </div>
  );
}
