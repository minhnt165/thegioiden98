import { ImageResponse } from "next/og";
import { OG_SIZE, OgWordmark, ogFonts } from "@/lib/shop/og";
import { getShopSettings } from "@/lib/shop/settings";

// Ảnh chia sẻ mặc định (Zalo, Facebook…) cho mọi trang không có ảnh riêng
export const alt = "Thế Giới Đèn 98 — Đèn & nội thất decor";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage() {
  const shop = await getShopSettings();
  const title = "Đèn & nội thất decor chọn lọc từ xưởng thủ công";
  const footer = `Showroom ${shop.address} · ${shop.openingHours}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 85% 20%, #F6E8C9 0%, #F3EFE7 55%)",
          color: "#1B1916",
          fontFamily: "Sans",
        }}
      >
        <OgWordmark fontSize={40} />
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: 84, lineHeight: 1.02, letterSpacing: -1.5, maxWidth: 900 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#5E5952" }}>{footer}</div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
