import { ImageResponse } from "next/og";
import { cloneElement, type ReactElement } from "react";
import { ProductArt, artKindFor, tintFor } from "@/components/shop/ProductArt";
import { formatVND } from "@/lib/format";
import { getProduct, productImageUrl } from "@/lib/shop/catalog";
import { OG_SIZE, OgWordmark, ogFonts } from "@/lib/shop/og";

// Ảnh chia sẻ link sản phẩm: ảnh bìa (chưa có ảnh thì hình minh họa) + tên + giá
export const alt = "Sản phẩm — Thế Giới Đèn 98";
export const size = OG_SIZE;
export const contentType = "image/png";

// Màu ô ảnh theo tintFor (giá trị --color-swatch-* trong globals.css)
const SWATCH: Record<string, string> = {
  "bg-swatch-1": "#E8DFD0",
  "bg-swatch-2": "#D9DED3",
  "bg-swatch-3": "#E5D3C8",
  "bg-swatch-4": "#DAD7D0",
};

export default async function ProductOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  const name = product?.name ?? "Thế Giới Đèn 98";
  const eyebrow = product?.categoryName ?? "Sản phẩm";
  const price = product ? `${product.priceVaries ? "Từ " : ""}${formatVND(product.basePrice)}` : "";
  const compare = product?.compareAtPrice && product.compareAtPrice > product.basePrice ? formatVND(product.compareAtPrice) : "";
  const cover = product ? (product.images.find((i) => i.isCover) ?? product.images[0]) : undefined;
  const art = cloneElement(ProductArt({ kind: artKindFor(product?.categorySlug ?? null, name) }) as ReactElement<{ width: number; height: number }>, {
    width: 360,
    height: 432,
  });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F3EFE7", color: "#1B1916", fontFamily: "Sans" }}>
        <div
          style={{
            width: 630,
            height: 630,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SWATCH[tintFor(slug)] ?? "#E8DFD0",
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse chỉ vẽ được thẻ <img>
            <img src={productImageUrl(cover.path)} alt="" width={630} height={630} style={{ objectFit: "cover" }} />
          ) : (
            art
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px" }}>
          <OgWordmark fontSize={28} />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: "#5E5952" }}>{eyebrow}</div>
            <div style={{ display: "flex", fontFamily: "Serif", fontSize: 72, lineHeight: 1.02, letterSpacing: -1 }}>{name}</div>
            {price && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontSize: 36 }}>
                {price}
                {compare && <span style={{ fontSize: 26, color: "#5E5952", textDecoration: "line-through" }}>{compare}</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#5E5952" }}>Đặt qua Zalo · Messenger</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
