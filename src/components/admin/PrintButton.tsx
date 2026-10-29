"use client";

import { BTN_PRIMARY } from "./ui";

export function PrintButton({ label = "In phiếu" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
      {label}
    </button>
  );
}
