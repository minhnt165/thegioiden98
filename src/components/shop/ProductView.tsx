"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { formatVND } from "@/lib/format";
import { buildOrderMessage } from "@/lib/shop/contact";
import { OrderButtons } from "./OrderButtons";
import { ProductArt, type ArtKind } from "./ProductArt";

type Option = { id: string; name: string; values: { id: string; value: string; hex: string | null }[] };
type Variant = { id: string; sku: string; price: number; stock: number; optionValues: Record<string, string> };

type Props = {
  product: {
    name: string;
    eyebrow: string;
    lead: string | null;
    basePrice: number;
    compareAtPrice: number | null;
    badge: string | null;
    url: string;
  };
  options: Option[];
  variants: Variant[];
  images: { url: string }[];
  art: { kind: ArtKind; tint: string };
  contact: { zaloPhone: string; messengerUrl: string; deliveryTime: string; preorderTime: string };
  /** Bảng thông số (render ở server) */
  children?: ReactNode;
};

const LOW_STOCK = 3;

function matches(variant: Variant, selection: Record<string, string>, options: Option[]) {
  return options.every((o) => variant.optionValues[o.name] === selection[o.name]);
}

function Gallery({ images, art, name, badge, shade }: { images: Props["images"]; art: Props["art"]; name: string; badge: string | null; shade?: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex min-w-0 flex-col gap-3 md:gap-4">
      {/* Vuông, nhưng không cao quá màn hình (màn rộng thành khung ngang) để luôn thấy trọn sản phẩm */}
      <div
        className={`relative flex aspect-square max-h-[calc(100svh-11rem)] min-h-80 w-full items-center justify-center overflow-hidden rounded-[22px] md:rounded-[28px] ${art.tint}`}
      >
        {current ? (
          <Image
            src={current.url}
            alt={`${name} — ảnh ${active + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover lg:object-contain"
          />
        ) : (
          <ProductArt
            kind={art.kind}
            shade={shade}
            className="h-[64%] w-auto max-w-[70%] transition-colors duration-300 [&_path]:transition-colors"
          />
        )}
        {badge && (
          <span className="absolute left-4 top-4 rounded-full bg-ink px-2.5 py-1.5 text-[11px] uppercase tracking-widest text-cream md:left-4.5 md:top-4.5">
            {badge}
          </span>
        )}
        {images.length > 1 && (
          <span className="absolute bottom-4 right-4 rounded-full bg-white/85 px-2.5 py-1 text-[12px] text-muted">
            {active + 1}/{images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              aria-label={`Ảnh ${i + 1}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={`relative aspect-square overflow-hidden rounded-[14px] ${i === active ? "border-2 border-ink" : "border border-line"}`}
            >
              <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Gallery + chọn phân loại (đổi giá, tồn, SKU) + nút đặt hàng. Theo design/ProductDetail.html */
export function ProductView({ product, options, variants, images, art, contact, children }: Props) {
  const initial = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(initial?.optionValues ?? {});
  const variant = variants.find((v) => matches(v, selection, options));

  function choose(optionName: string, value: string) {
    const next = { ...selection, [optionName]: value };
    if (variants.some((v) => matches(v, next, options))) {
      setSelection(next);
      return;
    }
    // Tổ hợp không tồn tại: nhảy sang phân loại gần nhất có giá trị vừa chọn (ưu tiên còn hàng)
    const fallback =
      variants.find((v) => v.optionValues[optionName] === value && v.stock > 0) ??
      variants.find((v) => v.optionValues[optionName] === value);
    if (fallback) setSelection(fallback.optionValues);
  }

  function isAvailable(optionName: string, value: string) {
    const next = { ...selection, [optionName]: value };
    return variants.some((v) => matches(v, next, options));
  }

  const price = variant?.price ?? product.basePrice;
  const compareAt = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const variantLabel = options.map((o) => `${o.name}: ${selection[o.name]}`).join(", ");
  const colorOption = options.find((o) => o.values.some((v) => v.hex));
  const shade = colorOption?.values.find((v) => v.value === selection[colorOption.name])?.hex ?? undefined;

  let stockText: string;
  if (!variant) stockText = "Phân loại này tạm chưa có";
  else if (variant.stock <= 0) stockText = `Đặt trước · Giao trong ${contact.preorderTime}`;
  else if (variant.stock <= LOW_STOCK) stockText = `Chỉ còn ${variant.stock} chiếc · Giao trong ${contact.deliveryTime}`;
  else stockText = `Còn hàng · Giao trong ${contact.deliveryTime}`;

  const message = buildOrderMessage({
    productName: product.name,
    variantLabel: options.length ? variantLabel : null,
    sku: variant?.sku,
    price: formatVND(price),
    url: product.url,
  });

  return (
    <section className="flex flex-col gap-8 px-5 pb-14 pt-5 md:px-12 md:pb-18 md:pt-6 lg:flex-row lg:items-start lg:gap-14">
      <div className="min-w-0 lg:flex-[999_1_520px]">
        <Gallery images={images} art={art} name={product.name} badge={product.badge} shade={shade} />
      </div>

      <div id="dat-hang" className="flex min-w-0 flex-col gap-7 lg:max-w-120 lg:flex-[1_1_380px]">
        <div className="flex flex-col gap-3">
          <span className="text-[12px] uppercase tracking-[0.14em] text-muted">
            {product.eyebrow}
            {variant && ` · Mã SP: ${variant.sku}`}
          </span>
          <h1 className="font-serif text-[38px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">{product.name}</h1>
          {product.lead && <p className="text-[16px] leading-[1.65] text-muted">{product.lead}</p>}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <span className="text-[26px] font-medium md:text-[30px]">{formatVND(price)}</span>
          {compareAt && <span className="text-[16px] text-muted line-through">{formatVND(compareAt)}</span>}
          <span className={`text-[14px] ${variant && variant.stock > 0 ? "text-muted" : "text-terracotta"}`}>{stockText}</span>
        </div>

        {options.map((option) => {
          const swatches = option.values.some((v) => v.hex);
          return (
            <fieldset key={option.id} className="flex flex-col gap-3">
              <legend className="mb-3 text-[14px]">
                {option.name}
                {swatches && (
                  <>
                    : <strong className="font-medium">{selection[option.name]}</strong>
                  </>
                )}
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {option.values.map((v) => {
                  const active = selection[option.name] === v.value;
                  const available = isAvailable(option.name, v.value);
                  return swatches ? (
                    <button
                      key={v.id}
                      type="button"
                      aria-label={v.value}
                      aria-pressed={active}
                      title={v.value}
                      onClick={() => choose(option.name, v.value)}
                      style={{ background: v.hex ?? "#DCD5C7" }}
                      className={`size-11 rounded-full border-2 border-cream ${active ? "outline-2 outline-ink" : "outline-1 outline-line"} ${available ? "" : "opacity-40"}`}
                    />
                  ) : (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose(option.name, v.value)}
                      className={`h-11 rounded-full px-4.5 text-[14px] ${
                        active ? "bg-ink text-cream" : "border border-line bg-white hover:border-ink"
                      } ${available ? "" : "text-muted line-through"}`}
                    >
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="pt-2">
          <OrderButtons message={message} zaloPhone={contact.zaloPhone} messengerUrl={contact.messengerUrl} disabled={!variant} />
          {!contact.zaloPhone && !contact.messengerUrl && (
            <p className="rounded-card border border-line bg-white p-4 text-[14px] text-muted">
              Shop đang cập nhật kênh nhắn tin. Bạn ghé showroom hoặc gọi trực tiếp để đặt món này nhé.
            </p>
          )}
        </div>

        {children}
      </div>

      {/* Thanh đặt hàng cố định ở đáy màn hình điện thoại */}
      {(contact.zaloPhone || contact.messengerUrl) && (
        <div data-order-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:hidden">
          <OrderButtons
            layout="bar"
            message={message}
            zaloPhone={contact.zaloPhone}
            messengerUrl={contact.messengerUrl}
            disabled={!variant}
          />
        </div>
      )}
    </section>
  );
}
