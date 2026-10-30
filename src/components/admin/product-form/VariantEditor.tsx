"use client";

import { PencilLine, Plus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { StockAdjustDialog } from "@/components/admin/StockAdjustDialog";
import {
  buildSku,
  rebuildVariants,
  renameOptionKey,
  renameOptionValue,
  variantLabel,
  type OptionDraft,
  type VariantDraft,
} from "@/lib/admin/variants";
import { MoneyInput } from "./MoneyInput";

const SMALL_INPUT = "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] outline-none focus:border-ink";
const MAX_OPTIONS = 3;

type Props = {
  options: OptionDraft[];
  variants: VariantDraft[];
  skuBase: string;
  defaultPrice: number;
  onChange: (options: OptionDraft[], variants: VariantDraft[]) => void;
  /** Đã điều chỉnh tồn một phân loại đã lưu (qua sổ kho, không qua nút Lưu sản phẩm) */
  onStockAdjusted: (variantId: string, stock: number) => void;
};

const isColorOption = (name: string) => /màu/i.test(name);

function ValueChipInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (v) onAdd(v);
    setDraft("");
  };
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commit();
        }
      }}
      onBlur={commit}
      placeholder="Thêm giá trị, Enter"
      aria-label="Thêm giá trị"
      className={`${SMALL_INPUT} w-40`}
    />
  );
}

/** Nhóm phân loại (Màu chao × Kích cỡ…) và bảng SKU / giá / tồn / bật bán cho từng tổ hợp */
export function VariantEditor({ options, variants, skuBase, defaultPrice, onChange, onStockAdjusted }: Props) {
  const [bulkPrice, setBulkPrice] = useState<number | null>(null);
  const [bulkStock, setBulkStock] = useState<string>("");
  const [adjusting, setAdjusting] = useState<{ id: string; label: string; stock: number } | null>(null);
  const defaults = { price: defaultPrice, skuBase };

  // Mọi thay đổi nhóm đều dựng lại bảng, giữ dữ liệu cũ của tổ hợp không đổi
  const updateOptions = (next: OptionDraft[], base: VariantDraft[] = variants) => onChange(next, rebuildVariants(next, base, defaults));

  const setOption = (index: number, patch: Partial<OptionDraft>) =>
    updateOptions(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  function renameOption(index: number, name: string) {
    const from = options[index].name;
    const next = options.map((o, i) => (i === index ? { ...o, name } : o));
    // Đổi tên nhóm không làm thay đổi tổ hợp → chỉ đổi khóa, không dựng lại
    onChange(next, renameOptionKey(variants, from, name));
  }

  function renameValue(optionIndex: number, valueIndex: number, value: string) {
    const option = options[optionIndex];
    const from = option.values[valueIndex].value;
    const values = option.values.map((v, i) => (i === valueIndex ? { ...v, value } : v));
    onChange(
      options.map((o, i) => (i === optionIndex ? { ...o, values } : o)),
      renameOptionValue(variants, option.name, from, value),
    );
  }

  const setVariant = (index: number, patch: Partial<VariantDraft>) =>
    onChange(options, variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const colorOf = (v: VariantDraft) => {
    const color = options.find((o) => isColorOption(o.name));
    return color?.values.find((x) => x.value === v.optionValues[color.name])?.hex ?? null;
  };

  return (
    <div className="flex flex-col gap-4">
      {options.map((option, oi) => (
        <div key={oi} className="flex flex-col gap-2.5 rounded-xl bg-cream p-3.5">
          <div className="flex items-center gap-2">
            <input
              value={option.name}
              onChange={(e) => renameOption(oi, e.target.value)}
              placeholder="Tên nhóm, vd: Màu chao"
              aria-label={`Tên nhóm phân loại ${oi + 1}`}
              className={`${SMALL_INPUT} w-48 font-medium`}
            />
            <button
              type="button"
              onClick={() => updateOptions(options.filter((_, i) => i !== oi))}
              className="ml-auto text-[13px] text-muted hover:text-status-red"
            >
              Xóa nhóm
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {option.values.map((val, vi) => (
              <span key={vi} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-1.5 pr-1">
                {isColorOption(option.name) && (
                  <input
                    type="color"
                    aria-label={`Mã màu ${val.value}`}
                    value={val.hex ?? "#DCD5C7"}
                    onChange={(e) =>
                      setOption(oi, { values: option.values.map((x, i) => (i === vi ? { ...x, hex: e.target.value.toUpperCase() } : x)) })
                    }
                    className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                )}
                <input
                  value={val.value}
                  onChange={(e) => renameValue(oi, vi, e.target.value)}
                  aria-label={`Giá trị ${vi + 1} của ${option.name}`}
                  size={Math.max(val.value.length, 4)}
                  className="bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  aria-label={`Bỏ ${val.value}`}
                  onClick={() => setOption(oi, { values: option.values.filter((_, i) => i !== vi) })}
                  className="flex size-5 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-status-red"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </span>
            ))}
            <ValueChipInput
              onAdd={(value) =>
                !option.values.some((v) => v.value.toLowerCase() === value.toLowerCase()) &&
                setOption(oi, { values: [...option.values, { value, hex: isColorOption(option.name) ? "#DCD5C7" : null }] })
              }
            />
          </div>
        </div>
      ))}

      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => updateOptions([...options, { name: options.length ? "Kích cỡ" : "Màu", values: [] }])}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-line bg-white px-3 text-[13px] hover:border-ink"
        >
          <Plus aria-hidden className="size-4" /> Thêm nhóm phân loại
        </button>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-line-soft pt-3 text-[13px]">
        <span className="mr-1 self-center text-muted">Áp dụng cho mọi dòng:</span>
        <MoneyInput value={bulkPrice} allowEmpty onChange={setBulkPrice} placeholder="Giá" aria-label="Giá áp dụng cho mọi dòng" className={`${SMALL_INPUT} w-32`} />
        <input
          type="number"
          min={0}
          value={bulkStock}
          onChange={(e) => setBulkStock(e.target.value)}
          placeholder="Tồn"
          aria-label="Tồn ban đầu áp dụng cho dòng mới"
          title="Chỉ áp cho phân loại chưa lưu; tồn của phân loại đã có đổi qua nút Điều chỉnh"
          className={`${SMALL_INPUT} w-20`}
        />
        <button
          type="button"
          disabled={bulkPrice === null && bulkStock === ""}
          onClick={() => {
            onChange(
              options,
              variants.map((v) => ({
                ...v,
                price: bulkPrice ?? v.price,
                stock: bulkStock === "" || v.id ? v.stock : Math.max(0, Number.parseInt(bulkStock, 10) || 0),
              })),
            );
            setBulkPrice(null);
            setBulkStock("");
          }}
          className="h-9 rounded-lg border border-line bg-white px-3 hover:border-ink disabled:opacity-40"
        >
          Áp dụng
        </button>
        <button
          type="button"
          onClick={() => onChange(options, variants.map((v) => ({ ...v, sku: buildSku(skuBase, v.optionValues, options) })))}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted hover:text-ink"
          title="Đặt lại SKU theo SKU gốc + giá trị phân loại"
        >
          <RefreshCw aria-hidden className="size-3.5" /> Tạo lại SKU
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-140 border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="px-2 py-2 font-medium">Phân loại</th>
              <th className="px-2 py-2 font-medium">SKU</th>
              <th className="px-2 py-2 font-medium">Giá</th>
              <th className="px-2 py-2 font-medium">Tồn kho</th>
              <th className="px-2 py-2 font-medium">Đang bán</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => {
              const hex = colorOf(v);
              const label = variantLabel(v, options);
              return (
                <tr key={`${label}-${i}`} className={`border-t border-line-soft ${v.isActive ? "" : "text-muted"}`}>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-2">
                      {hex && <span className="size-3.5 rounded-full border border-line" style={{ background: hex }} />}
                      {label}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} aria-label={`SKU ${label}`} className={`${SMALL_INPUT} w-36`} />
                  </td>
                  <td className="px-2 py-2">
                    <MoneyInput value={v.price} onChange={(price) => setVariant(i, { price: price ?? 0 })} aria-label={`Giá ${label}`} className={`${SMALL_INPUT} w-32`} />
                  </td>
                  <td className="px-2 py-2">
                    {v.id ? (
                      // Đã lưu: tồn chỉ đổi qua sổ kho (điều chỉnh / phiếu nhập / đơn)
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-10 text-right tabular-nums ${v.stock <= 0 ? "text-status-red" : ""}`}>{v.stock}</span>
                        <button
                          type="button"
                          aria-label={`Điều chỉnh tồn ${label}`}
                          title="Điều chỉnh tồn"
                          onClick={() => setAdjusting({ id: v.id!, label, stock: v.stock })}
                          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-cream hover:text-ink"
                        >
                          <PencilLine aria-hidden className="size-3.5" />
                        </button>
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={v.stock}
                        onChange={(e) => setVariant(i, { stock: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                        aria-label={`Tồn kho ${label}`}
                        title="Tồn ban đầu"
                        className={`${SMALL_INPUT} w-20 ${v.stock <= 0 ? "text-status-red" : ""}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={v.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} aria-label={`Đang bán ${label}`} className="size-4 accent-ink" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted">
        {variants.length} phân loại · bỏ chọn “Đang bán” để ẩn một phân loại khỏi cửa hàng mà vẫn giữ SKU.
      </p>
      {adjusting && (
        <StockAdjustDialog
          variantId={adjusting.id}
          label={adjusting.label}
          stock={adjusting.stock}
          onClose={() => setAdjusting(null)}
          onDone={(stock) => {
            onStockAdjusted(adjusting.id, stock);
            setAdjusting(null);
          }}
        />
      )}
    </div>
  );
}
