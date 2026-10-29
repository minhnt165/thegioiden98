import "server-only";

import type { ReactNode } from "react";

// Dùng chung cho ảnh chia sẻ (opengraph-image): font thương hiệu + khung logo

export const OG_SIZE = { width: 1200, height: 630 };

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

/**
 * Tải nguyên file font TTF từ Google Fonts (ImageResponse không đọc được woff2), giữ trong bộ nhớ server.
 * Không dùng tham số text= để cắt font: bản cắt làm lệch dấu mũ chữ "ô", "ộ".
 * Lỗi mạng thì trả null để ảnh vẫn ra bằng font mặc định (lần sau thử tải lại).
 */
function loadGoogleFont(family: string, weight: number, italic: boolean): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}:${italic}`;
  let font = fontCache.get(key);
  if (!font) {
    font = (async () => {
      try {
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:ital,wght@${italic ? 1 : 0},${weight}`)).text();
        const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
        const res = url ? await fetch(url) : null;
        if (!res?.ok) throw new Error(`Không tải được font ${family}`);
        return await res.arrayBuffer();
      } catch {
        fontCache.delete(key);
        return null;
      }
    })();
    fontCache.set(key, font);
  }
  return font;
}

/** Font cho ImageResponse: Cormorant Garamond (tiêu đề) + Manrope (chữ thường), giống trang web */
export async function ogFonts() {
  const [serif, serifItalic, sans] = await Promise.all([
    loadGoogleFont("Cormorant Garamond", 500, false),
    loadGoogleFont("Cormorant Garamond", 500, true),
    loadGoogleFont("Manrope", 600, false),
  ]);
  return [
    serif && { name: "Serif", data: serif, weight: 500 as const, style: "normal" as const },
    serifItalic && { name: "Serif", data: serifItalic, weight: 500 as const, style: "italic" as const },
    sans && { name: "Sans", data: sans, weight: 600 as const, style: "normal" as const },
  ].filter((f) => f !== null);
}

export function OgLogo({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <path d="M12 54 A38 38 0 0 1 88 54 Z" fill="#1B1916" />
      <circle cx="50" cy="66" r="17" fill="#B8612A" />
      <path d="M34 92 H66" stroke="#1B1916" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** Logo chữ "Thế Giới Đèn 98" như header cửa hàng */
export function OgWordmark({ fontSize = 34, children }: { fontSize?: number; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <OgLogo size={fontSize * 1.6} />
      <div style={{ display: "flex", fontFamily: "Serif", fontSize, letterSpacing: -0.5 }}>
        Thế Giới Đèn&nbsp;<span style={{ fontStyle: "italic", color: "#B8612A" }}>98</span>
      </div>
      {children}
    </div>
  );
}
