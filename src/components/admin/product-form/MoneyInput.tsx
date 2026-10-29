"use client";

import { INPUT } from "../ui";

const fmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Ô nhập tiền: hiển thị "1.890.000", lưu số nguyên. Để trống → null (khi allowEmpty). */
export function MoneyInput({
  value,
  onChange,
  allowEmpty = false,
  className = INPUT,
  ...rest
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value === null ? "" : fmt.format(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
        onChange(digits ? Number(digits) : allowEmpty ? null : 0);
      }}
      className={className}
    />
  );
}
