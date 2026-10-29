"use client";

import { Bold, Italic, Link2, List } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = { id: string; value: string; onChange: (html: string) => void };

const TOOLS = [
  { label: "In đậm", icon: Bold, run: () => document.execCommand("bold") },
  { label: "In nghiêng", icon: Italic, run: () => document.execCommand("italic") },
  { label: "Danh sách", icon: List, run: () => document.execCommand("insertUnorderedList") },
  {
    label: "Chèn liên kết",
    icon: Link2,
    run: () => {
      const url = window.prompt("Dán đường dẫn (https://…)");
      if (url && /^https?:\/\//i.test(url.trim())) document.execCommand("createLink", false, url.trim());
    },
  },
];

/**
 * Trình soạn thảo đơn giản (đậm, nghiêng, danh sách, liên kết) cho mô tả sản phẩm.
 * HTML được lọc lại bằng sanitize-html ở server trước khi lưu và trước khi hiển thị.
 * Đoạn đầu tiên hiện thành câu trích dẫn lớn ở mục "Câu chuyện" trên trang sản phẩm.
 */
export function RichTextEditor({ id, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Chỉ nạp HTML ban đầu một lần; sau đó DOM là nguồn dữ liệu (tránh nhảy con trỏ khi gõ)
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = value || "<p><br></p>";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  return (
    <div className="flex flex-col">
      <div role="toolbar" aria-label="Định dạng mô tả" className="flex gap-1 rounded-t-input border border-b-0 border-line bg-cream p-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            aria-label={tool.label}
            title={tool.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              ref.current?.focus();
              tool.run();
              emit();
            }}
            className="flex size-8 items-center justify-center rounded-md hover:bg-white"
          >
            <tool.icon aria-hidden className="size-4" strokeWidth={1.8} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          // Dán chữ thuần để không kéo theo định dạng lạ từ Word/web
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        className="min-h-36 rounded-b-input border border-line bg-white px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-ink [&_a]:text-terracotta [&_a]:underline [&_p]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc"
      />
    </div>
  );
}
