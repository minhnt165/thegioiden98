"use client";

import { useState, useTransition } from "react";
import { setOrdersStatus, updateOrderNote } from "@/app/admin/(panel)/don-hang/actions";
import { NEXT_STATUSES, STATUS_ACTION } from "@/lib/admin/order-filters";
import type { Enums } from "@/types/database";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from "./ui";

type Target = "packing" | "shipping" | "done" | "cancelled" | "returned";

const BTN_DANGER =
  "inline-flex h-10.5 items-center justify-center rounded-input bg-status-red px-4 text-[14px] font-medium text-white disabled:opacity-50";

/** Nút chuyển trạng thái ở trang chi tiết. Hủy / trả hàng mở ô nhập lý do trước khi xác nhận. */
export function OrderStatusActions({ id, status }: { id: string; status: Enums<"order_status"> }) {
  const [asking, setAsking] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = NEXT_STATUSES[status] as Target[];
  if (!targets.length) return <p className="text-[13px] text-muted">Đơn đã đóng, không còn bước tiếp theo.</p>;

  function run(to: Target, note = "") {
    setError(null);
    startTransition(async () => {
      const result = await setOrdersStatus([id], to, note);
      if (!result.ok) setError(result.error);
      else if (!result.data.changed) setError("Đơn vừa được đổi trạng thái ở nơi khác — tải lại trang để xem.");
      else {
        setAsking(null);
        setReason("");
      }
    });
  }

  if (asking) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] leading-relaxed">{STATUS_ACTION[asking].confirm}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Lý do (không bắt buộc)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={`${INPUT} h-auto py-2.5`} />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-status-red">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(asking, reason)} className={BTN_DANGER}>
            {STATUS_ACTION[asking].label}
          </button>
          <button type="button" disabled={pending} onClick={() => setAsking(null)} className={BTN_SECONDARY}>
            Thôi
          </button>
        </div>
      </div>
    );
  }

  const [primary, ...others] = targets;
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-[13px] text-status-red">
          {error}
        </p>
      )}
      {STATUS_ACTION[primary].confirm ? (
        <button type="button" disabled={pending} onClick={() => setAsking(primary)} className={BTN_SECONDARY}>
          {STATUS_ACTION[primary].label}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(primary)} className={BTN_PRIMARY}>
          {STATUS_ACTION[primary].label}
        </button>
      )}
      {others.map((to) => (
        <button
          key={to}
          type="button"
          disabled={pending}
          onClick={() => (STATUS_ACTION[to].confirm ? setAsking(to) : run(to))}
          className={`${BTN_SECONDARY} ${to === "cancelled" ? "text-status-red" : ""}`}
        >
          {STATUS_ACTION[to].label}
        </button>
      ))}
    </div>
  );
}

/** Ghi chú nội bộ: chỉ shop thấy, sửa được ở mọi trạng thái */
export function OrderNote({ id, note }: { id: string; note: string | null }) {
  const [value, setValue] = useState(note ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== (note ?? "");

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderNote(id, value);
      setMessage(result.ok ? { ok: true, text: "Đã lưu ghi chú." } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label className="sr-only" htmlFor={`note-${id}`}>
        Ghi chú nội bộ
      </label>
      <textarea
        id={`note-${id}`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage(null);
        }}
        rows={3}
        maxLength={1000}
        placeholder="Ví dụ: giao giờ hành chính, gọi trước 30 phút…"
        className={`${INPUT} h-auto py-2.5`}
      />
      <div className="flex items-center justify-between gap-2">
        <span role={message?.ok === false ? "alert" : "status"} className={`text-[12px] ${message?.ok === false ? "text-status-red" : "text-muted"}`}>
          {message?.text}
        </span>
        <button type="button" disabled={pending || !dirty} onClick={save} className="h-8.5 rounded-lg border border-line px-3 text-[13px] hover:border-ink disabled:opacity-50">
          Lưu ghi chú
        </button>
      </div>
    </div>
  );
}
