"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/admin/(panel)/cai-dat/actions";
import { BTN_PRIMARY, Card, INPUT, LABEL } from "./ui";

type Field = { key: string; label: string; hint?: string; placeholder?: string; type?: "text" | "number" | "textarea"; rows?: number };

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "Thông tin shop",
    fields: [
      { key: "shop_name", label: "Tên shop" },
      { key: "shop_address", label: "Địa chỉ showroom", placeholder: "An Khánh, Hà Nội" },
      { key: "opening_hours", label: "Giờ mở cửa", placeholder: "9h–17h" },
      { key: "about_text", label: "Giới thiệu ngắn", hint: "Hiện ở mục “Về chúng tôi” trên trang chủ.", type: "textarea", rows: 3 },
    ],
  },
  {
    title: "Kênh liên hệ",
    fields: [
      { key: "zalo_phone", label: "SĐT Zalo", placeholder: "0912 345 678", hint: "Nút “Đặt hàng qua Zalo” mở zalo.me với số này." },
      { key: "messenger_url", label: "Link Messenger", placeholder: "https://m.me/tenpage", hint: "Dùng link m.me để tin nhắn có sẵn nội dung." },
      { key: "instagram_url", label: "Link Instagram", placeholder: "https://instagram.com/tenshop" },
    ],
  },
  {
    title: "Giao hàng",
    fields: [
      { key: "delivery_time", label: "Thời gian giao hàng có sẵn", placeholder: "1–3 ngày" },
      { key: "preorder_time", label: "Thời gian hàng đặt trước", placeholder: "2–3 tuần" },
      { key: "shipping_notes", label: "Ghi chú giao hàng & đổi trả", hint: "Mỗi dòng một ý, hiện ở trang sản phẩm.", type: "textarea", rows: 4 },
    ],
  },
  {
    title: "Báo giá & kho",
    fields: [
      { key: "quote_default_terms", label: "Điều khoản báo giá mặc định", type: "textarea", rows: 5 },
      { key: "quote_validity_days", label: "Hiệu lực báo giá mặc định (ngày)", type: "number" },
      { key: "low_stock_threshold", label: "Cảnh báo sắp hết khi tồn ≤", hint: "Áp dụng cho sản phẩm không đặt ngưỡng riêng.", type: "number" },
    ],
  },
];

export function SettingsForm({ values }: { values: Record<string, string> }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, { status: "idle", message: "" });

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card key={section.title} title={section.title}>
            {section.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={f.key} className={LABEL}>
                  {f.label}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={f.key}
                    name={f.key}
                    rows={f.rows}
                    defaultValue={values[f.key]}
                    placeholder={f.placeholder}
                    className={`${INPUT} h-auto py-2.5 leading-relaxed`}
                  />
                ) : (
                  <input id={f.key} name={f.key} type={f.type ?? "text"} min={0} defaultValue={values[f.key]} placeholder={f.placeholder} className={INPUT} />
                )}
                {f.hint && <span className="text-[12px] text-muted">{f.hint}</span>}
              </div>
            ))}
          </Card>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-cream px-4 py-3 md:-mx-8 md:px-8">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? "Đang lưu…" : "Lưu cài đặt"}
        </button>
        <p role="status" className={`text-[13px] ${state.status === "error" ? "text-status-red" : "text-status-green"}`}>
          {state.message}
        </p>
      </div>
    </form>
  );
}
