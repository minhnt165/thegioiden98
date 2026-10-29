"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Search, X } from "lucide-react";
import { SiZalo } from "react-icons/si";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { saveQuote, type QuotePayload } from "@/app/admin/(panel)/bao-gia/actions";
import type { CustomerOption, VariantOption } from "@/lib/admin/orders";
import {
  QUOTE_EDITABLE,
  QUOTE_SAVED_NOTICE as FLASH,
  buildQuoteMessage,
  quoteDiscount,
  quoteUrl,
  vnToday,
  type QuoteSavedNotice as Flash,
} from "@/lib/admin/quote-filters";
import type { QuoteFormData } from "@/lib/admin/quotes";
import { CHANNEL_NAME, QUOTE_STATUS } from "@/lib/admin/status";
import { formatDateTime, formatVND } from "@/lib/format";
import { zaloLink } from "@/lib/shop/contact";
import { foldVietnamese } from "@/lib/shop/filters";
import type { Enums } from "@/types/database";
import { MoneyInput } from "./product-form/MoneyInput";
import { QuoteLinkBox, QuoteProgressActions, copyText, type QuoteRef } from "./QuoteActions";
import { BTN_SECONDARY, Badge, Card, INPUT, LABEL, PageHeader } from "./ui";

type Props = {
  initial: QuoteFormData;
  customers: CustomerOption[];
  variants: VariantOption[];
  flash?: Flash | null;
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
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-[12px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-cream has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta has-[:disabled]:cursor-default";
const DROPDOWN = "absolute inset-x-0 top-full z-20 mt-1 flex max-h-80 flex-col overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-sm";
const SMALL_INPUT = "h-9 rounded-lg border border-line bg-white px-2.5 text-right text-[13px] outline-none focus:border-ink disabled:bg-cream";

function phoneDigits(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

/** Bước trong thẻ "Tiến trình": done = xanh, current = cam, còn lại = vòng rỗng */
function Step({ state, title, detail, last = false }: { state: "done" | "current" | "todo"; title: React.ReactNode; detail?: string; last?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span
          className={`mt-1 size-3 shrink-0 rounded-full ${
            state === "done" ? "bg-status-green" : state === "current" ? "bg-terracotta" : "border-2 border-line"
          }`}
        />
        {!last && <span className="h-7 w-0.5 bg-line" />}
      </span>
      <span className={`flex flex-col gap-0.5 text-[13px] ${state === "todo" ? "text-muted" : ""}`}>
        <span className={state === "current" ? "font-medium" : ""}>{title}</span>
        {detail && <span className="text-[12px] text-muted">{detail}</span>}
      </span>
    </li>
  );
}

export function QuoteForm({ initial, customers, variants, flash = null }: Props) {
  const router = useRouter();
  const isNew = initial.id === null;
  const editable = QUOTE_EDITABLE.includes(initial.status);
  const uid = useId();
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  const [customer, setCustomer] = useState(initial.customer);
  const [channel, setChannel] = useState(initial.channel);
  const [message, setMessage] = useState(initial.message);
  const [terms, setTerms] = useState(initial.terms);
  const [discountPercent, setDiscountPercent] = useState(initial.discountPercent);
  const [shippingFee, setShippingFee] = useState(initial.shippingFee);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
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
  const [notice, setNotice] = useState<string | null>(flash ? FLASH[flash] : null);

  // Bỏ ?xong= khỏi URL để tải lại trang không hiện lại thông báo
  useEffect(() => {
    if (flash) window.history.replaceState(null, "", window.location.pathname);
  }, [flash]);
  const [pending, startTransition] = useTransition();

  const payload = (send: boolean): QuotePayload => ({
    id: initial.id,
    customer: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address },
    channel,
    message,
    terms,
    discountPercent,
    shippingFee,
    validUntil,
    send,
    items: items.map((i) => ({ variantId: i.variantId ?? "", qty: i.qty, unitPrice: i.unitPrice })),
  });

  // So với nội dung đã lưu để biết còn thay đổi chưa lưu (chặn tạo đơn theo bản cũ)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(payload(false)));
  const dirty = JSON.stringify(payload(false)) !== savedSnapshot;

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

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discount = quoteDiscount(subtotal, discountPercent);
  const total = subtotal - discount + shippingFee;

  function pickCustomer(c: CustomerOption) {
    setCustomer({ id: c.id, name: c.name, phone: c.phone ?? "", address: c.address ?? "" });
    setChannel(c.channel);
    setCustomerQuery("");
  }

  function addVariant(v: VariantOption) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === v.id);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        { key: v.id, variantId: v.id, name: v.productName, variant: v.label, sku: v.sku, qty: 1, unitPrice: v.price, coverUrl: v.coverUrl, tint: v.tint },
      ];
    });
    setProductQuery("");
  }

  const updateItem = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const setQty = (item: Item, qty: number) => updateItem(item.key, { qty: Math.max(1, Math.min(9999, qty)) });

  /** Lưu; send = true thì chuyển sang "đã gửi", chép lời nhắn + link và mở Zalo của khách */
  function submit(send: boolean) {
    setError(null);
    setNotice(null);
    if (!customer.name.trim()) return setError("Nhập tên khách hàng.");
    if (!items.length) return setError("Thêm ít nhất 1 sản phẩm vào báo giá.");
    const missing = items.find((i) => !i.variantId);
    if (missing) return setError(`"${missing.name}" không còn bán — xóa dòng đó rồi chọn lại.`);
    if (!validUntil) return setError("Chọn ngày hết hiệu lực.");
    if (send && validUntil < vnToday()) return setError("Ngày hiệu lực đã qua — chọn ngày khác trước khi gửi.");

    const zalo = send && channel !== "messenger" && customer.phone ? zaloLink(customer.phone) : null;

    startTransition(async () => {
      const result = await saveQuote(payload(send));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedSnapshot(JSON.stringify(payload(false)));
      let flash: Flash = "luu";
      if (send) {
        // Chép khi trang còn focus, sau đó mới mở Zalo (mở trước thì trình duyệt từ chối chép)
        const copied = await copyText(
          buildQuoteMessage({ code: result.data.code, customerName: customer.name.trim(), message, url: quoteUrl(result.data.token), validUntil }),
        );
        if (zalo) window.open(zalo, "_blank", "noopener,noreferrer");
        flash = !copied ? "gui-loi" : zalo ? "gui-zalo" : "gui-chep";
      }
      if (isNew) router.replace(`/admin/bao-gia/${result.data.id}?xong=${flash}`);
      else setNotice(FLASH[flash]);
    });
  }

  const status = QUOTE_STATUS[initial.status];
  const ref: QuoteRef | null =
    initial.id && initial.code && initial.token
      ? {
          id: initial.id,
          code: initial.code,
          status: initial.status,
          token: initial.token,
          customerName: initial.customer.name,
          customerPhone: initial.customer.phone || null,
          validUntil: initial.validUntil,
          orderId: initial.progress?.order?.id ?? null,
        }
      : null;
  const p = initial.progress;
  const closed = initial.status === "rejected" || initial.status === "expired";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="flex flex-col gap-5"
    >
      <PageHeader
        breadcrumb={[{ href: "/admin/bao-gia", label: "Báo giá" }]}
        title={isNew ? "Lập báo giá" : `Báo giá ${initial.code}`}
        subtitle={
          isNew ? (
            "Gửi link cho khách hỏi qua Zalo / Messenger; khách bấm đồng ý là thành đơn."
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              {!editable && "Báo giá đã chốt hoặc đã đóng — chỉ xem."}
            </span>
          )
        }
        actions={
          <>
            {ref && (
              <>
                <a href={`/bg/${ref.token}`} target="_blank" className={BTN_SECONDARY}>
                  Xem như khách
                </a>
                <a href={`/admin/in-bao-gia?id=${ref.id}`} target="_blank" className={BTN_SECONDARY}>
                  Tải PDF
                </a>
              </>
            )}
            {editable && (
              <>
                <button type="submit" disabled={pending} className={BTN_SECONDARY}>
                  {pending ? "Đang lưu…" : initial.status === "draft" ? "Lưu nháp" : "Lưu thay đổi"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(true)}
                  className="inline-flex h-10.5 items-center justify-center gap-2 rounded-input bg-zalo px-4.5 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {channel === "messenger" ? "Lưu & chép lời nhắn" : (
                    <>
                      <SiZalo aria-hidden className="size-5" />
                      {initial.status === "draft" || initial.status === "expired" ? "Gửi qua Zalo" : "Gửi lại qua Zalo"}
                    </>
                  )}
                </button>
              </>
            )}
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-3.5 py-2.5 text-[13px] text-status-red">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-input bg-status-green-bg px-3.5 py-2.5 text-[13px] text-status-green">
          {notice}
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-12">
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <Card
            title="Khách hàng"
            aside={
              <span className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Khách hỏi qua">
                <span className="text-[12px] text-muted">Hỏi qua</span>
                {(Object.keys(CHANNEL_NAME) as Enums<"sales_channel">[]).map((c) => (
                  <label key={c} className={CHIP}>
                    <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
                    <span aria-hidden className={`size-2 rounded-full ${CHANNEL_NAME[c].color}`} />
                    {CHANNEL_NAME[c].label}
                  </label>
                ))}
              </span>
            }
          >
            {!customer.id && editable && (
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
            <div className="grid gap-3.5 md:grid-cols-3">
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
                <span className={LABEL}>SĐT / Zalo</span>
                <input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  inputMode="tel"
                  maxLength={20}
                  autoComplete="off"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Địa chỉ giao</span>
                <input
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  maxLength={300}
                  autoComplete="off"
                  className={INPUT}
                />
              </label>
            </div>
            {customer.id ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                Khách cũ — sửa ở đây sẽ cập nhật hồ sơ khách ·
                <Link href={`/admin/khach-hang/${customer.id}`} target="_blank" className="text-ink underline-offset-4 hover:underline">
                  Xem lịch sử khách
                </Link>
                {editable && (
                  <button
                    type="button"
                    onClick={() => setCustomer({ id: null, name: "", phone: "", address: "" })}
                    className="rounded-full border border-line px-2.5 py-0.5 text-ink hover:border-ink"
                  >
                    Đổi khách
                  </button>
                )}
              </span>
            ) : (
              <span className="text-[12px] text-muted">SĐT trùng với khách cũ thì báo giá được gắn vào khách đó.</span>
            )}
          </Card>

          <Card title="Sản phẩm báo giá">
            {editable && (
              <div className="relative">
                <label className="flex h-11 items-center gap-2 rounded-input border border-dashed border-line-dashed bg-cream px-3.5 focus-within:border-ink">
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
                        if (productMatches[0]) addVariant(productMatches[0]);
                      }
                    }}
                    placeholder="Gõ tên hoặc SKU để thêm sản phẩm vào báo giá…"
                    aria-controls={`${uid}-products`}
                    className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                  />
                </label>
                {productQuery.trim() && (
                  <div id={`${uid}-products`} className={DROPDOWN}>
                    {productMatches.length ? (
                      productMatches.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => addVariant(v)}
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
                            <span className="text-[12px] text-muted">
                              SKU {v.sku}
                              {(!v.isActive || v.productStatus !== "active") && " · đang ẩn trên cửa hàng"}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-[14px]">{formatVND(v.price)}</span>
                            <span className={`text-[12px] ${v.stock <= 0 ? "text-status-amber" : "text-muted"}`}>
                              {v.stock <= 0 ? "Hết hàng · đặt trước" : `Còn ${v.stock}`}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-[13px] text-muted">Không tìm thấy sản phẩm.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-150 border-collapse text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      <th className="p-2 font-medium">Sản phẩm</th>
                      <th className="p-2 text-right font-medium">Đơn giá</th>
                      <th className="p-2 text-center font-medium">SL</th>
                      <th className="p-2 text-right font-medium">Thành tiền</th>
                      <th className="p-2">
                        <span className="sr-only">Xóa</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const v = item.variantId ? variantById.get(item.variantId) : undefined;
                      const short = v !== undefined && item.qty > v.stock;
                      return (
                        <tr key={item.key} className="border-t border-line-soft">
                          <td className="px-2 py-2.5">
                            <span className="flex items-center gap-3">
                              <span className={`relative size-11 shrink-0 overflow-hidden rounded-input ${item.tint}`}>
                                {item.coverUrl && <Image src={item.coverUrl} alt="" fill sizes="44px" className="object-cover" />}
                              </span>
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-[12px] text-muted">
                                  {[item.variant, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ") || "Không phân loại"}
                                </span>
                                {!item.variantId && <span className="text-[12px] text-status-red">Phân loại này đã bị xóa khỏi sản phẩm</span>}
                                {short && editable && (
                                  <span className="text-[12px] text-status-amber">
                                    Kho còn {v.stock} — khách đồng ý khi chưa đủ hàng thì shop tạo đơn tay
                                  </span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <label>
                              <span className="sr-only">Đơn giá {item.name}</span>
                              <MoneyInput
                                value={item.unitPrice}
                                onChange={(value) => updateItem(item.key, { unitPrice: value ?? 0 })}
                                className={`${SMALL_INPUT} w-30`}
                              />
                            </label>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="mx-auto flex w-fit items-center overflow-hidden rounded-lg border border-line bg-white">
                              <button
                                type="button"
                                aria-label={`Giảm số lượng ${item.name}`}
                                onClick={() => setQty(item, item.qty - 1)}
                                disabled={item.qty <= 1}
                                className="flex size-9 items-center justify-center hover:bg-cream disabled:opacity-40"
                              >
                                <Minus aria-hidden className="size-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={9999}
                                value={item.qty}
                                aria-label={`Số lượng ${item.name}`}
                                onChange={(e) => setQty(item, Number.parseInt(e.target.value, 10) || 1)}
                                className="h-9 w-11 bg-transparent text-center text-[14px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                aria-label={`Tăng số lượng ${item.name}`}
                                onClick={() => setQty(item, item.qty + 1)}
                                className="flex size-9 items-center justify-center hover:bg-cream"
                              >
                                <Plus aria-hidden className="size-3.5" />
                              </button>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium">{formatVND(item.unitPrice * item.qty)}</td>
                          <td className="px-2 py-2.5 text-right">
                            {editable && (
                              <button
                                type="button"
                                aria-label={`Bỏ ${item.name} khỏi báo giá`}
                                onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                                className="inline-flex size-8.5 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-ink"
                              >
                                <X aria-hidden className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-dashed px-4 py-8 text-center text-[14px] text-muted">
                Chưa có sản phẩm. Gõ tên hoặc SKU vào ô phía trên để thêm.
              </p>
            )}
          </Card>

          <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Lời nhắn cho khách</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Ví dụ: Chị Hà ơi, em gửi báo giá bộ đèn phòng khách như mình trao đổi ạ."
                className={`${INPUT} h-auto py-3 leading-relaxed`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Điều khoản (tự điền từ cài đặt)</span>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={5}
                maxLength={3000}
                className={`${INPUT} h-auto py-3 text-[13px] leading-relaxed text-muted`}
              />
            </label>
          </section>
        </fieldset>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          <Card title="Tổng kết">
            <fieldset disabled={!editable} className="flex flex-col gap-3 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-muted">Tạm tính ({count} sản phẩm)</span>
                <span>{formatVND(subtotal)}</span>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted">Giảm giá</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className={`${SMALL_INPUT} w-16`}
                  />
                  <span className="text-muted">%</span>
                </span>
              </label>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Tiền giảm</span>
                <span className="text-status-green">−{formatVND(discount)}</span>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted">Phí giao hàng</span>
                <MoneyInput value={shippingFee} onChange={(v) => setShippingFee(v ?? 0)} className={`${SMALL_INPUT} w-28`} />
              </label>
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="font-medium">Tổng báo giá</span>
                <span className="text-[24px] font-medium">{formatVND(total)}</span>
              </div>
              <label className="flex flex-col gap-1.5 pt-1.5">
                <span className={LABEL}>Hiệu lực đến</span>
                <input
                  type="date"
                  value={validUntil}
                  min={editable ? vnToday() : undefined}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                  className={INPUT}
                />
              </label>
            </fieldset>
          </Card>

          {ref && p && (
            <Card title="Tiến trình">
              <ol className="flex flex-col">
                <Step state="done" title="Lập báo giá" detail={[formatDateTime(p.createdAt), p.createdBy].filter(Boolean).join(" · ")} />
                <Step
                  state={p.sentAt ? "done" : initial.status === "draft" ? "current" : "todo"}
                  title={p.sentAt ? "Đã gửi cho khách" : "Chưa gửi khách"}
                  detail={p.sentAt ? formatDateTime(p.sentAt) : undefined}
                />
                <Step
                  state={p.viewedAt ? (p.acceptedAt || closed ? "done" : "current") : "todo"}
                  title={p.viewedAt ? "Khách đã mở link" : "Khách chưa mở link"}
                  detail={p.viewedAt ? `${formatDateTime(p.viewedAt)} · xem ${p.viewCount} lần` : undefined}
                />
                <Step
                  last
                  state={p.order ? "done" : p.acceptedAt ? "current" : "todo"}
                  title={
                    p.order ? (
                      <>
                        Đã thành đơn{" "}
                        <Link href={`/admin/don-hang/${p.order.id}`} className="underline-offset-4 hover:underline">
                          {p.order.code}
                        </Link>
                      </>
                    ) : initial.status === "rejected" ? (
                      "Khách không lấy"
                    ) : p.acceptedAt ? (
                      "Khách đồng ý — chờ tạo đơn"
                    ) : (
                      "Khách đồng ý → tạo đơn"
                    )
                  }
                  detail={p.acceptedAt ? formatDateTime(p.acceptedAt) : undefined}
                />
              </ol>
              <QuoteProgressActions quote={ref} dirty={dirty} />
            </Card>
          )}

          {ref && (
            <Card title="Link gửi khách">
              <QuoteLinkBox quote={ref} />
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
