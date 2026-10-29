"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { saveOrder } from "@/app/admin/(panel)/don-hang/actions";
import type { CustomerOption, OrderFormData, VariantOption } from "@/lib/admin/orders";
import { CHANNEL_NAME, PAYMENT_LABEL } from "@/lib/admin/status";
import { formatVND } from "@/lib/format";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums } from "@/types/database";
import { MoneyInput } from "./product-form/MoneyInput";
import { BTN_PRIMARY, BTN_SECONDARY, Card, INPUT, LABEL, PageHeader } from "./ui";

type Props = {
  initial: OrderFormData;
  customers: CustomerOption[];
  variants: VariantOption[];
};

type Item = {
  key: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  sku: string | null;
  qty: number;
  unitPrice: number;
  coverUrl: string | null;
  tint: string;
};

const CHIP =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-line px-3.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-cream has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta";
const DROPDOWN = "absolute inset-x-0 top-full z-20 mt-1 flex max-h-80 flex-col overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-sm";

function phoneDigits(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

export function OrderForm({ initial, customers, variants }: Props) {
  const router = useRouter();
  const isNew = initial.id === null;
  const uid = useId();
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  const [customer, setCustomer] = useState(initial.customer);
  const [channel, setChannel] = useState(initial.channel);
  const [payment, setPayment] = useState(initial.payment);
  const [discount, setDiscount] = useState(initial.discount);
  const [shippingFee, setShippingFee] = useState(initial.shippingFee);
  const [note, setNote] = useState(initial.note);
  const [items, setItems] = useState<Item[]>(() =>
    initial.items.map((i, index) => {
      const v = i.variantId ? variantById.get(i.variantId) : undefined;
      return {
        key: `${i.variantId ?? "missing"}-${index}`,
        variantId: i.variantId,
        name: i.name,
        variant: i.variant,
        sku: v?.sku ?? null,
        qty: i.qty,
        unitPrice: i.unitPrice,
        coverUrl: v?.coverUrl ?? null,
        tint: v?.tint ?? "bg-swatch-1",
      };
    }),
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Tồn có thể bán cho đơn này = tồn hiện tại + phần đơn đang giữ (khi sửa đơn) */
  const available = (variantId: string | null) =>
    variantId ? (variantById.get(variantId)?.stock ?? 0) + (initial.reserved[variantId] ?? 0) : 0;

  const customerMatches = useMemo(() => {
    const needle = foldVietnamese(customerQuery.trim());
    if (!needle) return [];
    const digits = customerQuery.replace(/\D/g, "");
    return customers
      .filter((c) => foldVietnamese(c.name).includes(needle) || (digits.length >= 3 && phoneDigits(c.phone).includes(digits)))
      .slice(0, 6);
  }, [customerQuery, customers]);

  const productMatches = useMemo(() => {
    const words = foldVietnamese(productQuery.trim()).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return variants
      .filter((v) => {
        const text = foldVietnamese(`${v.productName} ${v.label ?? ""} ${v.sku}`);
        return words.every((w) => text.includes(w));
      })
      .slice(0, 8);
  }, [productQuery, variants]);

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const total = Math.max(0, subtotal - discount) + shippingFee;

  function pickCustomer(c: CustomerOption) {
    setCustomer({ id: c.id, name: c.name, phone: c.phone ?? "", address: c.address ?? "" });
    if (isNew) setChannel(c.channel);
    setCustomerQuery("");
  }

  function addVariant(v: VariantOption) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === v.id);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          key: v.id,
          variantId: v.id,
          name: v.productName,
          variant: v.label,
          sku: v.sku,
          qty: 1,
          unitPrice: v.price,
          coverUrl: v.coverUrl,
          tint: v.tint,
        },
      ];
    });
    setProductQuery("");
  }

  const updateItem = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customer.name.trim()) return setError("Nhập tên khách hàng.");
    if (!items.length) return setError("Thêm ít nhất 1 sản phẩm vào đơn.");
    const missing = items.find((i) => !i.variantId);
    if (missing) return setError(`"${missing.name}" không còn trong kho — xóa dòng đó rồi chọn lại.`);
    const over = items.find((i) => i.qty > available(i.variantId));
    if (over) return setError(`${over.name}${over.variant ? ` (${over.variant})` : ""} chỉ còn ${available(over.variantId)} trong kho.`);
    if (discount > subtotal) return setError("Giảm giá không được lớn hơn tạm tính.");

    startTransition(async () => {
      const result = await saveOrder({
        id: initial.id,
        customer: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address },
        channel,
        payment,
        discount,
        shippingFee,
        note,
        items: items.map((i) => ({ variantId: i.variantId ?? "", qty: i.qty, unitPrice: i.unitPrice })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/don-hang/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ href: "/admin/don-hang", label: "Đơn hàng" }]}
        title={isNew ? "Tạo đơn thủ công" : `Sửa đơn ${initial.code}`}
        subtitle={isNew ? "Đơn nhận qua Zalo, Messenger hoặc tại showroom. Kho được trừ ngay khi lưu." : "Chỉ sửa được khi đơn đang chờ xác nhận."}
        actions={
          <>
            <Link href={isNew ? "/admin/don-hang" : `/admin/don-hang/${initial.id}`} className={BTN_SECONDARY}>
              Hủy
            </Link>
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? "Đang lưu…" : isNew ? "Tạo đơn" : "Lưu đơn"}
            </button>
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-3.5 py-2.5 text-[13px] text-status-red">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card
            title="Khách hàng"
            aside={
              customer.id ? (
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  Khách cũ — sửa ở đây sẽ cập nhật hồ sơ khách
                  <button
                    type="button"
                    onClick={() => setCustomer({ id: null, name: "", phone: "", address: "" })}
                    className="rounded-full border border-line px-2.5 py-1 text-ink hover:border-ink"
                  >
                    Khách mới
                  </button>
                </span>
              ) : null
            }
          >
            {!customer.id && (
              <div className="relative">
                <label className="flex h-11 items-center gap-2 rounded-input border border-line bg-white px-3.5 focus-within:border-ink">
                  <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
                  <span className="sr-only">Tìm khách cũ</span>
                  <input
                    type="search"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setCustomerQuery("");
                      // Enter chọn khách đầu tiên thay vì gửi form
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customerMatches[0]) pickCustomer(customerMatches[0]);
                      }
                    }}
                    placeholder="Tìm khách cũ theo tên hoặc SĐT…"
                    aria-controls={`${uid}-customers`}
                    className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                  />
                </label>
                {customerQuery.trim() && (
                  <div id={`${uid}-customers`} className={DROPDOWN}>
                    {customerMatches.length ? (
                      customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-cream focus-visible:bg-cream"
                        >
                          <span className="text-[14px]">
                            {c.name}
                            {c.phone && <span className="text-muted"> · {c.phone}</span>}
                          </span>
                          {c.address && <span className="truncate text-[12px] text-muted">{c.address}</span>}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-[13px] text-muted">Chưa có khách này — điền thông tin bên dưới để tạo mới.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Tên khách *</span>
                <input
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  maxLength={120}
                  required
                  autoComplete="off"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Số điện thoại</span>
                <input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  inputMode="tel"
                  maxLength={20}
                  autoComplete="off"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={LABEL}>Địa chỉ giao</span>
                <input
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  maxLength={300}
                  autoComplete="off"
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh"
                  className={INPUT}
                />
              </label>
            </div>
            {!customer.id && <p className="text-[12px] text-muted">SĐT trùng với khách cũ thì đơn được gắn vào khách đó.</p>}
          </Card>

          <Card title="Sản phẩm">
            <div className="relative">
              <label className="flex h-11 items-center gap-2 rounded-input border border-line bg-white px-3.5 focus-within:border-ink">
                <Search aria-hidden className="size-4 text-muted" strokeWidth={1.6} />
                <span className="sr-only">Thêm sản phẩm</span>
                <input
                  type="search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setProductQuery("");
                    // Enter chọn kết quả đầu tiên thay vì gửi form
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const first = productMatches.find((v) => available(v.id) > 0);
                      if (first) addVariant(first);
                    }
                  }}
                  placeholder="Tìm tên sản phẩm, phân loại hoặc SKU để thêm…"
                  aria-controls={`${uid}-products`}
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
              </label>
              {productQuery.trim() && (
                <div id={`${uid}-products`} className={DROPDOWN}>
                  {productMatches.length ? (
                    productMatches.map((v) => {
                      const left = available(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={left <= 0}
                          onClick={() => addVariant(v)}
                          className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-cream focus-visible:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className={`relative size-10 shrink-0 overflow-hidden rounded-lg ${v.tint}`}>
                            {v.coverUrl && <Image src={v.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-[14px]">
                              {v.productName}
                              {v.label && <span className="text-muted"> · {v.label}</span>}
                            </span>
                            <span className="text-[12px] text-muted">
                              SKU {v.sku}
                              {(!v.isActive || v.productStatus !== "active") && " · đang ẩn trên cửa hàng"}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-[14px]">{formatVND(v.price)}</span>
                            <span className={`text-[12px] ${left <= 0 ? "text-status-red" : "text-muted"}`}>{left <= 0 ? "Hết hàng" : `Còn ${left}`}</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2 text-[13px] text-muted">Không tìm thấy sản phẩm.</p>
                  )}
                </div>
              )}
            </div>

            {items.length ? (
              <ul className="flex flex-col">
                {items.map((item) => {
                  const left = available(item.variantId);
                  const over = item.variantId !== null && item.qty > left;
                  return (
                    <li key={item.key} className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3 last:border-0 sm:flex-nowrap">
                      <span className={`relative size-12 shrink-0 overflow-hidden rounded-input ${item.tint}`}>
                        {item.coverUrl && <Image src={item.coverUrl} alt="" fill sizes="48px" className="object-cover" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[14px] font-medium">{item.name}</span>
                        <span className="truncate text-[12px] text-muted">
                          {[item.variant, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ") || "Không phân loại"}
                        </span>
                        {!item.variantId && <span className="text-[12px] text-status-red">Phân loại này đã bị xóa khỏi sản phẩm</span>}
                        {over && <span className="text-[12px] text-status-red">Chỉ còn {left} trong kho</span>}
                      </span>
                      <label className="flex flex-col gap-1">
                        <span className="sr-only">Số lượng {item.name}</span>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={item.qty}
                          onChange={(e) => updateItem(item.key, { qty: Math.max(1, Math.min(9999, Number.parseInt(e.target.value, 10) || 1)) })}
                          className={`h-10 w-18 rounded-input border bg-white px-2.5 text-center text-[14px] outline-none focus:border-ink ${over ? "border-status-red" : "border-line"}`}
                        />
                      </label>
                      <span className="text-[13px] text-muted">×</span>
                      <label className="w-32">
                        <span className="sr-only">Đơn giá {item.name}</span>
                        <MoneyInput
                          value={item.unitPrice}
                          onChange={(v) => updateItem(item.key, { unitPrice: v ?? 0 })}
                          className="h-10 w-full rounded-input border border-line bg-white px-2.5 text-right text-[14px] outline-none focus:border-ink"
                        />
                      </label>
                      <span className="w-28 text-right text-[14px] font-medium">{formatVND(item.unitPrice * item.qty)}</span>
                      <button
                        type="button"
                        aria-label={`Xóa ${item.name} khỏi đơn`}
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                        className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-ink"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line-dashed px-4 py-8 text-center text-[14px] text-muted">
                Chưa có sản phẩm. Gõ tên hoặc SKU vào ô tìm kiếm phía trên để thêm.
              </p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card title="Kênh & thanh toán">
            <fieldset className="flex flex-col gap-2">
              <legend className={`${LABEL} mb-2`}>Khách đặt qua</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CHANNEL_NAME) as Enums<"sales_channel">[]).map((c) => (
                  <label key={c} className={CHIP}>
                    <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
                    {CHANNEL_NAME[c].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${LABEL} mb-2`}>Thanh toán</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PAYMENT_LABEL) as Enums<"payment_method">[]).map((p) => (
                  <label key={p} className={CHIP}>
                    <input type="radio" name="payment" value={p} checked={payment === p} onChange={() => setPayment(p)} className="sr-only" />
                    {PAYMENT_LABEL[p]}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card title="Tổng tiền">
            <div className="flex flex-col gap-3 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-muted">Tạm tính</span>
                <span>{formatVND(subtotal)}</span>
              </div>
              <label className="flex items-center justify-between gap-4">
                <span className="text-muted">Giảm giá</span>
                <MoneyInput
                  value={discount}
                  onChange={(v) => setDiscount(v ?? 0)}
                  className={`h-10 w-36 rounded-input border bg-white px-2.5 text-right text-[14px] outline-none focus:border-ink ${discount > subtotal ? "border-status-red" : "border-line"}`}
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-muted">Phí giao hàng</span>
                <MoneyInput
                  value={shippingFee}
                  onChange={(v) => setShippingFee(v ?? 0)}
                  className="h-10 w-36 rounded-input border border-line bg-white px-2.5 text-right text-[14px] outline-none focus:border-ink"
                />
              </label>
              <div className="flex justify-between gap-4 border-t border-line-soft pt-3 text-[16px] font-medium">
                <span>Tổng cộng</span>
                <span>{formatVND(total)}</span>
              </div>
            </div>
          </Card>

          <Card title="Ghi chú nội bộ">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              aria-label="Ghi chú nội bộ"
              placeholder="Chỉ shop thấy. Ví dụ: giao giờ hành chính, gọi trước 30 phút…"
              className={`${INPUT} h-auto py-2.5`}
            />
          </Card>
        </div>
      </div>
    </form>
  );
}
