import Link from "next/link";

type LogoProps = {
  /** "light" dùng trên nền kem, "dark" dùng trên nền than (sidebar admin) */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
};

const SIZES = {
  sm: { mark: 32, text: "text-[16px]" },
  md: { mark: 40, text: "text-[19px]" },
  lg: { mark: 96, text: "text-[44px]" },
} as const;

export function LogoMark({ tone = "light", size = 40 }: { tone?: "light" | "dark"; size?: number }) {
  const ink = tone === "dark" ? "#F3EFE7" : "#1B1916";
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
      <path d="M12 54 A38 38 0 0 1 88 54 Z" fill={ink} />
      <circle cx="50" cy="66" r="17" fill="#B8612A" />
      <path d="M34 92 H66" stroke={ink} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ tone = "light", size = "md", href = "/", className = "" }: LogoProps) {
  const s = SIZES[size];
  const content = (
    <>
      <LogoMark tone={tone} size={s.mark} />
      <span className={`flex flex-col font-serif leading-none tracking-[-0.02em] ${s.text}`}>
        <span className="font-normal">Thế Giới Đèn</span>
        <span className="mt-0.5 font-light italic text-terracotta">98</span>
      </span>
    </>
  );
  const classes = `inline-flex items-center gap-3 ${tone === "dark" ? "text-cream" : "text-ink"} ${className}`;

  if (href === null) {
    return <span className={classes}>{content}</span>;
  }
  return (
    <Link href={href} aria-label="Thế Giới Đèn 98 — Trang chủ" className={classes}>
      {content}
    </Link>
  );
}
