"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/admin/actions";

const INPUT = "h-11 rounded-input border border-line bg-white px-3.5 text-[14px] outline-none focus:border-ink";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null, email: "" });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] text-muted">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={state.email} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] text-muted">
          Mật khẩu
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={INPUT} />
      </div>
      {state.error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-3.5 py-2.5 text-[13px] text-status-red">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 rounded-input bg-ink text-[14px] font-medium text-cream hover:text-glow disabled:opacity-60"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
