"use client";

import { useActionState } from "react";
import { acceptQuote, type AcceptState } from "@/app/bg/[token]/actions";

/** Nút "Đồng ý & đặt hàng" trên trang báo giá. preview: admin đang xem thử nên không bấm được. */
export function AcceptQuoteButton({ token, preview = false }: { token: string; preview?: boolean }) {
  const [state, action, pending] = useActionState<AcceptState>(acceptQuote.bind(null, token), { error: null });

  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending || preview}
        title={preview ? "Bản xem trước của shop — khách mới bấm được" : undefined}
        className="flex h-13.5 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-cream transition-colors hover:text-glow disabled:opacity-50"
      >
        {pending ? "Đang gửi cho shop…" : "Đồng ý & đặt hàng"}
      </button>
      {state.error && (
        <p role="alert" className="text-center text-[13px] text-status-red">
          {state.error}
        </p>
      )}
    </form>
  );
}
