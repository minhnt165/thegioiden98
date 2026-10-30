"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createStockReceipt } from "@/app/admin/(panel)/kho/actions";
import type { VariantOption } from "@/lib/admin/orders";
import { PRODUCT_STATUS } from "@/lib/admin/status";
import { searchVariants } from "@/lib/admin/variant-search";
import { BTN_PRIMARY, BTN_SECONDARY, Badge, Card, INPUT, LABEL, PageHeader } from "./ui";

const DROPDOWN = "absolute inset-x-0 top-full z-20 mt-1 flex max-h-80 flex-col overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-sm";
const MAX_QTY = 100_000;

type Line = { variantId: string; qty: number };

/** Lập phiếu nhập: tìm phân loại (cả SP nháp / đang ẩn), nhập số lượng, ghi chú; lưu một lần để cộng kho */
export function StockReceiptForm({ variants }: { variants: VariantOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const matches = useMemo(() => searchVariants(variants, query), [variants, query]);
  const dirty = lines.length > 0 || note.trim() !== "";
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  /** Chọn phân loại: đã có trong phiếu thì cộng thêm 1 */
  function add(v: VariantOption) {
    setLines((list) =>
      list.some((l) => l.variantId === v.id)
        ? list.map((l) => (l.variantId === v.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + 1) } : l))
        : [...list, { variantId: v.id, qty: 1 }],
    );
    setQuery("");
    setError(null);
  }

  const setQty = (variantId: string, qty: number) => setLines((list) => list.map((l) => (l.variantId === variantId ? { ...l, qty } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) {
      setError("Thêm ít nhất 1 sản phẩm vào phiếu.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createStockReceipt({ note, items: lines });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/admin/kho/nhap/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <PageHeader
        title="Tạo phiếu nhập"
        breadcrumb={[{ href: "/admin/kho", label: "Kho" }]}
        subtitle="Lưu phiếu là cộng kho ngay. Phiếu đã lưu không sửa được."
        actions={
          <>
            <Link href="/admin/kho" className={BTN_SECONDARY}>
              Hủy
            </Link>
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? "Đang lưu…" : "Lưu phiếu nhập"}
            </button>
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-4 py-3 text-[14px] text-status-red">
          {error}
        </p>
      )}

      <Card title="Sản phẩm nhập" aside={lines.length ? <span className="text-[13px] text-muted">{lines.length} dòng · tổng {totalQty}</span> : null}>
        <div className="relative">
          <label className="flex h-11 items-center gap-2 rounded-input border border-line bg-white px-3.5 focus-within:border-ink">
            <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
            <span className="sr-only">Thêm sản phẩm vào phiếu</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
                // Enter chọn kết quả đầu tiên thay vì gửi form
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[0]) add(matches[0]);
                }
              }}
              placeholder="Gõ tên hoặc SKU để thêm vào phiếu…"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            />
          </label>
          {query.trim() && (
            <div className={DROPDOWN}>
              {matches.length ? (
                matches.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => add(v)}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-cream focus-visible:bg-cream"
                  >
                    <span className={`relative size-10 shrink-0 overflow-hidden rounded-lg ${v.tint}`}>
                      {v.coverUrl && <Image src={v.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14px]">
                        {v.productName}
                        {v.label && <span className="text-muted"> · {v.label}</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                        SKU {v.sku}
                        {v.productStatus !== "active" && <Badge tone="gray">{PRODUCT_STATUS[v.productStatus].label}</Badge>}
                        {!v.isActive && <Badge tone="gray">Phân loại tắt</Badge>}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">Tồn {v.stock}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2.5 text-[13px] text-muted">Không có sản phẩm khớp “{query.trim()}”.</p>
              )}
            </div>
          )}
        </div>

        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="px-2 py-2 font-medium">Sản phẩm</th>
                  <th className="px-2 py-2 text-right font-medium">Tồn hiện tại</th>
                  <th className="px-2 py-2 text-right font-medium">Số lượng nhập</th>
                  <th className="px-2 py-2 text-right font-medium">Tồn sau nhập</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const v = byId.get(l.variantId)!;
                  return (
                    <tr key={l.variantId} className="border-t border-line-soft">
                      <td className="px-2 py-2.5">
                        <span className="flex flex-col gap-0.5">
                          <span>
                            {v.productName}
                            {v.label && <span className="text-muted"> · {v.label}</span>}
                          </span>
                          <span className="text-[12px] text-muted">SKU {v.sku}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{v.stock}</td>
                      <td className="px-2 py-2.5 text-right">
                        <input
                          type="number"
                          min={1}
                          max={MAX_QTY}
                          value={l.qty}
                          onChange={(e) => setQty(l.variantId, Math.max(1, Math.min(MAX_QTY, Number.parseInt(e.target.value, 10) || 1)))}
                          aria-label={`Số lượng ${v.sku}`}
                          className="h-10 w-24 rounded-input border border-line bg-white px-2.5 text-right text-[14px] outline-none focus:border-ink"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        <span className="sr-only">Tồn sau nhập: </span>
                        {v.stock + l.qty}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          aria-label={`Bỏ ${v.sku}`}
                          onClick={() => setLines((list) => list.filter((x) => x.variantId !== l.variantId))}
                          className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-status-red"
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[14px] text-muted">Chưa có sản phẩm. Gõ tên hoặc SKU vào ô tìm kiếm phía trên để thêm.</p>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pn-note" className={LABEL}>
            Ghi chú (nhà cung cấp, số hóa đơn…)
          </label>
          <textarea id="pn-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${INPUT} h-auto py-2.5`} />
        </div>
      </Card>
    </form>
  );
}
