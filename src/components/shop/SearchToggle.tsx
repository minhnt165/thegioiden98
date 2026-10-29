"use client";

import Form from "next/form";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Đóng tìm kiếm" : "Tìm kiếm"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white"
      >
        {open ? <X aria-hidden className="size-5.5" strokeWidth={1.6} /> : <Search aria-hidden className="size-5.5" strokeWidth={1.6} />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 border-b border-line bg-cream px-4 py-4 md:px-12">
          <Form action="/san-pham" onSubmit={() => setOpen(false)} className="mx-auto flex max-w-2xl gap-2">
            <label htmlFor="site-search" className="sr-only">
              Tìm sản phẩm
            </label>
            <input
              ref={inputRef}
              id="site-search"
              name="q"
              type="search"
              placeholder="Tìm đèn, ghế, bình gốm…"
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[15px] outline-none focus:border-ink"
            />
            <button type="submit" className="h-11 rounded-full bg-ink px-5 text-[14px] font-medium text-cream">
              Tìm
            </button>
          </Form>
        </div>
      )}
    </>
  );
}
