import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Icon cho màn hình chính iOS: biến thể "Icon app" của logo, nền than (iOS tự bo góc)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1B1916" }}>
        <svg viewBox="0 0 100 100" width="180" height="180">
          <path d="M22 54 A28 28 0 0 1 78 54 Z" fill="#F3EFE7" />
          <circle cx="50" cy="64" r="13" fill="#B8612A" />
          <path d="M38 84 H62" stroke="#F3EFE7" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
