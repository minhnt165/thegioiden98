"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { adjustStock } from "@/app/admin/(panel)/kho/actions";
import { STOCK_REASON } from "@/lib/admin/status";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, SELECT } from "./ui";

type Reason = keyof typeof STOCK_REASON;

type Props = {
  variantId: string;
  /** Nhãn phân loại: "Trắng · Nhỏ" */
  label: string;
  stock: number;
  onClose: () => void;
  onDone: (stock: number) => void;
};

/**
 * Hộp thoại điều chỉnh tồn một phân loại. Render qua portal và chặn submit lan ra ngoài,
 * vì nó nằm trong form sản phẩm (Enter ở đây không được lưu cả sản phẩm).
 */
export function StockAdjustDialog({ variantId, label, stock, onClose, onDone }: Props) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = Number.parseInt(delta, 10);
  const after = Number.isFinite(change) ? stock + change : stock;
  const invalid = !Number.isFinite(change) || change === 0 || after < 0 || !reason || (reason === "other" && !note.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (invalid || !reason) return;
    setError(null);
    startTransition(async () => {
      const result = await adjustStock({ variantId, delta: change, reason, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(result.data.stock);
    });
  }

  const title = `Điều chỉnh tồn ${label}`;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => !pending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-medium">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-ink">
            <X aria-hidden className="size-4.5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sa-delta" className={LABEL}>
              Số thay đổi
            </label>
            <input
              id="sa-delta"
              type="number"
              step={1}
              autoFocus
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Vd: -2 khi vỡ 2 cái, 3 khi đếm thừa 3 cái"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sa-reason" className={LABEL}>
              Lý do
            </label>
            <select id="sa-reason" value={reason} onChange={(e) => setReason(e.target.value as Reason)} className={`${SELECT} h-11`}>
              <option value="" disabled>
                Chọn lý do
              </option>
              {(Object.keys(STOCK_REASON) as Reason[]).map((r) => (
                <option key={r} value={r}>
                  {STOCK_REASON[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sa-note" className={LABEL}>
              Ghi chú{reason === "other" ? " *" : ""}
            </label>
            <textarea id="sa-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={`${INPUT} h-auto py-2.5`} />
          </div>

          <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">
            <span>Tồn hiện tại: {stock}</span>
            <span className={after < 0 ? "text-status-red" : "text-ink"}>Tồn sau điều chỉnh: {after}</span>
          </p>
          {error && (
            <p role="alert" className="rounded-input bg-status-red-bg px-3.5 py-2.5 text-[13px] text-status-red">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={pending} className={BTN_SECONDARY}>
              Hủy
            </button>
            <button type="submit" disabled={invalid || pending} className={BTN_PRIMARY}>
              {pending ? "Đang lưu…" : "Lưu điều chỉnh"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
