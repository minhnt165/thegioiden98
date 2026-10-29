"use client";

import { BTN_PRIMARY } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
      In phiếu
    </button>
  );
}
