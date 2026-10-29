// Hình minh họa thay ảnh khi sản phẩm chưa có ảnh thật (theo mockup design/Main.html).

export type ArtKind = "lamp" | "floor" | "pendant" | "wall" | "chair" | "table" | "vase";

const TINTS = ["bg-swatch-1", "bg-swatch-2", "bg-swatch-3", "bg-swatch-4"] as const;

/** Màu nền ổn định theo slug, để cùng một món luôn cùng một màu */
export function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function artKindFor(categorySlug: string | null, name: string): ArtKind {
  switch (categorySlug) {
    case "den-san":
      return "floor";
    case "den-tha":
      return "pendant";
    case "den-tuong":
      return "wall";
    case "do-decor":
      return "vase";
    case "ghe-ban":
      return /^bàn/i.test(name) ? "table" : "chair";
    default:
      return "lamp";
  }
}

export function ProductArt({ kind, className = "", shade = "#1B1916" }: { kind: ArtKind; className?: string; shade?: string }) {
  const common = { "aria-hidden": true, viewBox: "0 0 200 240", className } as const;
  switch (kind) {
    case "floor":
      return (
        <svg {...common}>
          <path d="M50 215 Q50 40 150 40" fill="none" stroke="#1B1916" strokeWidth="7" strokeLinecap="round" />
          <path d="M126 40 L174 40 L186 84 L114 84 Z" fill={shade} />
          <rect x="28" y="212" width="46" height="9" rx="4" fill="#1B1916" />
        </svg>
      );
    case "pendant":
      return (
        <svg {...common}>
          <path d="M100 10 V95" stroke="#1B1916" strokeWidth="3" />
          <path d="M55 95 H145 L170 165 H30 Z" fill={shade} />
          <circle cx="100" cy="178" r="16" fill="#F6E8C9" />
        </svg>
      );
    case "wall":
      return (
        <svg {...common}>
          <path d="M40 60 H110" stroke="#1B1916" strokeWidth="8" strokeLinecap="round" />
          <path d="M40 60 V180" stroke="#1B1916" strokeWidth="8" strokeLinecap="round" />
          <path d="M110 60 A48 48 0 0 1 110 156" fill={shade} />
          <circle cx="128" cy="108" r="14" fill="#F6E8C9" />
        </svg>
      );
    case "chair":
      return (
        <svg {...common}>
          <path d="M60 40 Q60 20 80 20 H120 Q140 20 140 40 V120 H60 Z" fill={shade} />
          <rect x="40" y="120" width="120" height="30" rx="8" fill="#1B1916" />
          <path d="M55 150 V215 M145 150 V215 M70 150 V200 M130 150 V200" stroke="#1B1916" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
    case "table":
      return (
        <svg {...common}>
          <ellipse cx="100" cy="90" rx="85" ry="26" fill={shade} />
          <path d="M60 110 L45 200 M140 110 L155 200 M100 116 V200" stroke="#1B1916" strokeWidth="7" strokeLinecap="round" />
        </svg>
      );
    case "vase":
      return (
        <svg {...common}>
          <path d="M80 30 H120 V60 Q165 80 160 140 Q155 205 100 210 Q45 205 40 140 Q35 80 80 60 Z" fill={shade} />
          <path d="M100 22 V5" stroke="#1B1916" strokeWidth="3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <ellipse cx="100" cy="125" rx="70" ry="55" fill="#F6E8C9" />
          <path d="M60 40 L140 40 L162 125 L38 125 Z" fill={shade} />
          <rect x="96" y="125" width="8" height="75" fill="#1B1916" />
          <ellipse cx="100" cy="205" rx="38" ry="9" fill="#1B1916" />
        </svg>
      );
  }
}
