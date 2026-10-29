"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/app/(shop)/actions";

const INITIAL: NewsletterState = { status: "idle", message: "" };

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email-footer" className="text-[14px] text-muted">
        Bộ sưu tập mới và ưu đãi, mỗi tháng một email.
      </label>
      <div className="flex gap-2">
        <input
          id="email-footer"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="email@cuaban.vn"
          aria-describedby="email-footer-status"
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 rounded-full bg-ink px-4.5 text-[14px] font-medium text-cream disabled:opacity-60"
        >
          {pending ? "Đang gửi…" : "Đăng ký"}
        </button>
      </div>
      <p
        id="email-footer-status"
        role="status"
        className={`min-h-5 text-[13px] ${state.status === "error" ? "text-status-red" : "text-status-green"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
