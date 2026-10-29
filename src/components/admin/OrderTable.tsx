"use client";

import Image from "next/image";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setOrdersStatus } from "@/app/admin/(panel)/don-hang/actions";
import { STATUS_ACTION } from "@/lib/admin/order-filters";
import { CHANNEL_NAME, ORDER_STATUS, PAYMENT_LABEL } from "@/lib/admin/status";
import { formatDateTime, formatVND } from "@/lib/format";
import type { Enums } from "@/types/database";
import { Badge } from "./ui";

export type OrderTableRow = {
  id: string;
  code: string;
  status: Enums<"order_status">;
  channel: Enums<"sales_channel">;
  payment: Enums<"payment_method">;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  itemsSummary: string;
  variantHint: string;
  coverUrl: string | null;
  tint: string;
};

type Target = "packing" | "shipping" | "done" | "cancelled" | "returned";

const SMALL_BTN = "inline-flex h-8.5 items-center rounded-lg border border-line bg-white px-3 text-[13px] hover:border-ink disabled:opacity-50";

/** Nút nhanh trên từng dòng theo mockup: chờ xác nhận → "Xác nhận", chờ đóng gói → "Đã gói", còn lại → "Xem" */
const QUICK: Partial<Record<Enums<"order_status">, { label: string; to: Target }>> = {
  pending: { label: "Xác nhận", to: "packing" },
  packing: { label: "Đã gói", to: "shipping" },
};

/** Bảng đơn hàng: chọn nhiều để xác nhận / in phiếu giao / hủy. Cuộn ngang trên màn nhỏ. */
export function OrderTable({ rows }: { rows: OrderTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(rows, (state, change: { ids: string[]; status: Target }) =>
    state.map((r) => (change.ids.includes(r.id) ? { ...r, status: change.status } : r)),
  );

  function changeStatus(ids: string[], status: Target) {
    const action = STATUS_ACTION[status];
    if (action.confirm && !window.confirm(action.confirm.replace("đơn này", ids.length > 1 ? `${ids.length} đơn` : "đơn này"))) return;
    setMessage(null);
    startTransition(async () => {
      applyOptimistic({ ids, status });
      const result = await setOrdersStatus(ids, status);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const skipped = ids.length - result.data.changed;
      setMessage({
        ok: result.data.changed > 0,
        text: result.data.changed
          ? `${action.done} ${result.data.changed} đơn${skipped ? ` · bỏ qua ${skipped} đơn không ở bước phù hợp` : ""}.`
          : "Không đơn nào ở bước phù hợp để đổi trạng thái.",
      });
      setSelected(new Set());
    });
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[13px]">
          <span className="mr-2">
            Đã chọn <strong className="font-medium">{selected.size}</strong> đơn
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus([...selected], "packing")}
            className="h-8.5 rounded-lg bg-ink px-3 text-cream disabled:opacity-50"
          >
            Xác nhận
          </button>
          <a href={`/admin/phieu-giao?ids=${[...selected].join(",")}`} target="_blank" className={SMALL_BTN}>
            In phiếu giao
          </a>
          <button type="button" disabled={pending} onClick={() => changeStatus([...selected], "cancelled")} className={`${SMALL_BTN} text-status-red`}>
            Hủy đơn
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-muted hover:text-ink">
            Bỏ chọn
          </button>
        </div>
      )}
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-input px-3.5 py-2.5 text-[13px] ${message.ok ? "bg-status-green-bg text-status-green" : "bg-status-red-bg text-status-red"}`}
        >
          {message.text}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-245 border-collapse text-[14px]">
          <thead>
            <tr className="bg-cream text-left text-[12px] text-muted">
              <th className="w-12 px-4 py-3 font-medium">
                <input type="checkbox" aria-label="Chọn tất cả" checked={allChecked} onChange={toggleAll} className="size-4 accent-ink" />
              </th>
              <th className="px-2 py-3 font-medium">Mã đơn</th>
              <th className="px-2 py-3 font-medium">Khách hàng</th>
              <th className="px-2 py-3 font-medium">Sản phẩm</th>
              <th className="px-2 py-3 font-medium">Kênh</th>
              <th className="px-2 py-3 font-medium">Thanh toán</th>
              <th className="px-2 py-3 text-right font-medium">Tổng tiền</th>
              <th className="px-2 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {optimistic.map((o) => {
              const quick = QUICK[o.status];
              return (
                <tr key={o.id} className="border-t border-line-soft">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Chọn đơn ${o.code}`}
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      className="size-4 accent-ink"
                    />
                  </td>
                  <td className="px-2 py-3.5">
                    <Link href={`/admin/don-hang/${o.id}`} className="flex flex-col gap-0.5 hover:text-terracotta">
                      <span className="font-medium">{o.code}</span>
                      <span className="whitespace-nowrap text-[12px] text-muted">{formatDateTime(o.createdAt)}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="flex flex-col gap-0.5">
                      <span>{o.customerName}</span>
                      {o.customerPhone && <span className="text-[12px] text-muted">{o.customerPhone}</span>}
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className={`relative size-9 shrink-0 overflow-hidden rounded-lg ${o.tint}`}>
                        {o.coverUrl && <Image src={o.coverUrl} alt="" fill sizes="36px" className="object-cover" />}
                      </span>
                      <span className="flex max-w-64 flex-col gap-0.5">
                        <span className="line-clamp-2">{o.itemsSummary}</span>
                        <span className="text-[12px] text-muted">{o.variantHint}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
                      <span aria-hidden className={`size-2 rounded-full ${CHANNEL_NAME[o.channel].color}`} />
                      {CHANNEL_NAME[o.channel].label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5 text-[13px]">{PAYMENT_LABEL[o.payment]}</td>
                  <td className="whitespace-nowrap px-2 py-3.5 text-right font-medium">{formatVND(o.total)}</td>
                  <td className="px-2 py-3.5">
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    {quick ? (
                      <button type="button" disabled={pending} onClick={() => changeStatus([o.id], quick.to)} className={SMALL_BTN}>
                        {quick.label}
                      </button>
                    ) : (
                      <Link href={`/admin/don-hang/${o.id}`} className={SMALL_BTN}>
                        Xem
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {optimistic.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[14px] text-muted">
                  Không có đơn nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
