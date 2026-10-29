"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCustomer, saveCustomer, type CustomerPayload } from "@/app/admin/(panel)/khach-hang/actions";
import { CHANNEL_NAME } from "@/lib/admin/status";
import type { Enums } from "@/types/database";
import { BTN_PRIMARY, INPUT, LABEL } from "./ui";

const CHIP =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-cream has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta";

/** Form thông tin khách: thêm mới (chuyển sang trang khách sau khi lưu) hoặc sửa tại trang chi tiết */
export function CustomerForm({ initial, canDelete = false }: { initial: CustomerPayload; canDelete?: boolean }) {
  const router = useRouter();
  const isNew = initial.id === null;
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  const set = (patch: Partial<CustomerPayload>) => {
    setValue((prev) => ({ ...prev, ...patch }));
    setMessage(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveCustomer(value);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (isNew) return router.push(`/admin/khach-hang/${result.data.id}`);
      setSaved(value);
      setMessage({ ok: true, text: "Đã lưu thông tin khách." });
    });
  }

  function remove() {
    if (!initial.id || !window.confirm(`Xóa khách “${initial.name}”? Không hoàn tác được.`)) return;
    const id = initial.id;
    startTransition(async () => {
      const result = await deleteCustomer(id);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      router.replace("/admin/khach-hang");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Tên khách *</span>
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} required autoComplete="off" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>SĐT / Zalo</span>
        <input
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Địa chỉ giao</span>
        <input
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
          maxLength={300}
          autoComplete="off"
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh"
          className={INPUT}
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL} mb-2`}>Thường liên hệ qua</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHANNEL_NAME) as Enums<"sales_channel">[]).map((c) => (
            <label key={c} className={CHIP}>
              <input type="radio" name="channel" value={c} checked={value.channel === c} onChange={() => set({ channel: c })} className="sr-only" />
              <span aria-hidden className={`size-2 rounded-full ${CHANNEL_NAME[c].color}`} />
              {CHANNEL_NAME[c].label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Ghi chú về khách</span>
        <textarea
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
          rows={3}
          maxLength={1000}
          placeholder="Chỉ shop thấy. Ví dụ: khách quen, thích đồ gỗ, hay nhận hàng buổi tối…"
          className={`${INPUT} h-auto py-2.5`}
        />
      </label>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[13px] ${message.ok ? "text-status-green" : "text-status-red"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canDelete ? (
          <button type="button" disabled={pending} onClick={remove} className="text-[13px] text-muted underline-offset-4 hover:text-status-red hover:underline disabled:opacity-50">
            Xóa khách
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={pending || (!isNew && !dirty)} className={BTN_PRIMARY}>
          {pending ? "Đang lưu…" : isNew ? "Thêm khách" : "Lưu thông tin"}
        </button>
      </div>
    </form>
  );
}
