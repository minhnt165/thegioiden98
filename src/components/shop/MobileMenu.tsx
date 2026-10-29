"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { HOME_CATEGORIES, MAIN_NAV } from "./nav";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Mở menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white"
      >
        <Menu aria-hidden className="size-6" strokeWidth={1.6} />
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-cream">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <span className="font-serif text-[19px]">Menu</span>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white"
            >
              <X aria-hidden className="size-6" strokeWidth={1.6} />
            </button>
          </div>
          <nav aria-label="Danh mục chính" className="flex flex-1 flex-col gap-8 overflow-y-auto px-5 py-6">
            <ul className="flex flex-col">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-4 font-serif text-[28px] font-light"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <span className="text-[12px] uppercase tracking-[0.12em] text-muted">Danh mục</span>
              <div className="flex flex-wrap gap-2">
                {HOME_CATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/danh-muc/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px]"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
