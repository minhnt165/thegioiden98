import Image from "next/image";
import Link from "next/link";
import { formatVND } from "@/lib/format";
import { badgeLabel, productImageUrl, type CatalogProduct } from "@/lib/shop/catalog";
import { ProductArt, artKindFor, tintFor } from "./ProductArt";

export function ProductPrice({ product, className = "" }: { product: CatalogProduct; className?: string }) {
  return (
    <span className={className}>
      {product.priceVaries && <span className="text-muted">Từ </span>}
      {formatVND(product.basePrice)}
      {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
        <span className="ml-2 text-[0.87em] text-muted line-through">{formatVND(product.compareAtPrice)}</span>
      )}
    </span>
  );
}

export function ProductCard({
  product,
  size = "md",
  sizes = "(min-width: 1024px) 25vw, 50vw",
}: {
  product: CatalogProduct;
  size?: "sm" | "md";
  sizes?: string;
}) {
  const badge = badgeLabel(product.badge);
  const small = size === "sm";

  return (
    <Link href={`/san-pham/${product.slug}`} className="group flex min-w-0 flex-col gap-2.5 md:gap-3.5">
      <div
        className={`relative flex aspect-4/5 items-center justify-center overflow-hidden rounded-card ${tintFor(product.slug)}`}
      >
        {product.coverPath ? (
          <Image
            src={productImageUrl(product.coverPath)}
            alt={product.name}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductArt
            kind={artKindFor(product.categorySlug, product.name)}
            className="h-auto w-[62%] transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1.5 text-[11px] uppercase tracking-widest text-cream md:left-3.5 md:top-3.5">
            {badge}
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] text-muted">
            Đặt trước
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 md:gap-1">
        <span className={`font-medium text-ink group-hover:text-terracotta ${small ? "text-[14px]" : "text-[14px] md:text-[16px]"}`}>
          {product.name}
        </span>
        {product.material && (
          <span className={`text-muted ${small ? "text-[12px]" : "text-[12px] md:text-[13px]"}`}>{product.material}</span>
        )}
        <ProductPrice product={product} className={`mt-0.5 md:mt-1 ${small ? "text-[14px]" : "text-[14px] md:text-[15px]"}`} />
      </div>
    </Link>
  );
}
