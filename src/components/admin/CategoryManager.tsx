"use client";

import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteCategory, moveCategory, saveCategory, type CategoryPayload } from "@/app/admin/(panel)/danh-muc/actions";
import type { AdminCategory } from "@/lib/admin/categories";
import { slugify } from "@/lib/slug";
import { BTN_PRIMARY, BTN_SECONDARY, Badge, Card, INPUT, LABEL, SELECT } from "./ui";

const EMPTY: CategoryPayload = { id: null, name: "", slug: "", parentId: null, description: "" };

const ICON_BTN = "flex size-8 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-ink disabled:pointer-events-none disabled:opacity-30";

/** Trang danh mục: cây 2 cấp (sắp thứ tự trong cùng cấp) + form thêm / sửa */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const [form, setForm] = useState<CategoryPayload>(EMPTY);
  // Danh mục mới: đường dẫn tự sinh theo tên cho tới khi người dùng tự sửa
  const [slugTouched, setSlugTouched] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const editing = form.id ? categories.find((c) => c.id === form.id) : undefined;
  const roots = categories.filter((c) => !c.parentId);
  const siblingsOf = (c: AdminCategory) => categories.filter((x) => x.parentId === c.parentId);

  function edit(c: AdminCategory) {
    setForm({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, description: c.description });
    setSlugTouched(true);
    setMessage(null);
  }

  function reset(text: string | null = null) {
    setForm(EMPTY);
    setSlugTouched(false);
    setMessage(text ? { ok: true, text } : null);
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else done();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !form.id;
    run(
      () => saveCategory(form),
      () => (isNew ? reset(`Đã thêm danh mục “${form.name.trim()}”.`) : setMessage({ ok: true, text: "Đã lưu danh mục." })),
    );
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <Card title={`Danh mục (${categories.length})`} className="xl:col-span-8">
        {categories.length ? (
          <ul className="flex flex-col">
            {categories.map((c) => {
              const siblings = siblingsOf(c);
              const index = siblings.findIndex((s) => s.id === c.id);
              const selected = form.id === c.id;
              return (
                <li
                  key={c.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2.5 last:border-0 ${c.parentId ? "pl-7" : ""} ${
                    selected ? "-mx-2 rounded-lg bg-cream px-2" : ""
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {c.parentId && <span aria-hidden className="text-muted">└</span>}
                      <span className={c.parentId ? "text-[14px]" : "text-[15px] font-medium"}>{c.name}</span>
                      {c.locked && <Badge tone="blue">Trên menu cửa hàng</Badge>}
                    </span>
                    <a
                      href={`/danh-muc/${c.slug}`}
                      target="_blank"
                      className="inline-flex w-fit items-center gap-1 text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      /danh-muc/{c.slug}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  </span>
                  <span className="w-24 text-right text-[13px] text-muted">
                    {c.productCount} sản phẩm
                    {c.childCount > 0 && <span className="block text-[12px]">{c.childCount} danh mục con</span>}
                  </span>
                  <span className="flex">
                    <button
                      type="button"
                      aria-label={`Đưa ${c.name} lên`}
                      disabled={pending || index <= 0}
                      onClick={() => run(() => moveCategory(c.id, "up"), () => {})}
                      className={ICON_BTN}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Đưa ${c.name} xuống`}
                      disabled={pending || index >= siblings.length - 1}
                      onClick={() => run(() => moveCategory(c.id, "down"), () => {})}
                      className={ICON_BTN}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => edit(c)}
                    className="h-8.5 rounded-lg border border-line bg-white px-3 text-[13px] hover:border-ink"
                  >
                    Sửa
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">Chưa có danh mục nào.</p>
        )}
        <p className="text-[12px] leading-relaxed text-muted">
          Thứ tự ở đây là thứ tự hiện trong bộ lọc cửa hàng và ô chọn danh mục của sản phẩm. Menu chính và ô danh mục ở trang chủ được
          cố định theo thiết kế, nên các danh mục “Trên menu cửa hàng” không đổi được đường dẫn và không xóa được.
        </p>
      </Card>

      <Card title={editing ? `Sửa “${editing.name}”` : "Thêm danh mục"} className="xl:col-span-4">
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Tên danh mục *</span>
            <input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
              }}
              maxLength={80}
              required
              autoComplete="off"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Đường dẫn *</span>
            <span className="flex h-11 items-center rounded-input border border-line bg-white pl-3.5 text-[14px] focus-within:border-ink has-[:disabled]:bg-cream">
              <span className="text-muted">/danh-muc/</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }));
                }}
                disabled={editing?.locked}
                maxLength={80}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Chữ thường không dấu, số và dấu gạch ngang"
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent pr-3.5 outline-none"
              />
            </span>
            {editing?.locked && <span className="text-[12px] text-muted">Đang có trên menu cửa hàng — giữ nguyên đường dẫn.</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Thuộc danh mục</span>
            <select
              value={form.parentId ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value || null }))}
              disabled={Boolean(editing?.childCount)}
              className={`${SELECT} h-11 disabled:bg-cream`}
            >
              <option value="">— Danh mục gốc —</option>
              {roots
                .filter((r) => r.id !== form.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            {Boolean(editing?.childCount) && <span className="text-[12px] text-muted">Đang có danh mục con nên phải là danh mục gốc.</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Mô tả</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="Hiện ở đầu trang danh mục trên cửa hàng."
              className={`${INPUT} h-auto py-2.5`}
            />
          </label>

          {message && (
            <p role={message.ok ? "status" : "alert"} className={`text-[13px] ${message.ok ? "text-status-green" : "text-status-red"}`}>
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? "Đang lưu…" : editing ? "Lưu danh mục" : "Thêm danh mục"}
            </button>
            {editing && (
              <button type="button" disabled={pending} onClick={() => reset()} className={BTN_SECONDARY}>
                Thôi
              </button>
            )}
            {editing && !editing.locked && !editing.childCount && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Xóa danh mục “${editing.name}”?`)) return;
                  run(() => deleteCategory(editing.id), () => reset(`Đã xóa danh mục “${editing.name}”.`));
                }}
                className="ml-auto text-[13px] text-muted underline-offset-4 hover:text-status-red hover:underline disabled:opacity-50"
              >
                Xóa danh mục
              </button>
            )}
          </div>
          {editing && editing.productCount > 0 && !editing.locked && !editing.childCount && (
            <span className="text-[12px] text-muted">Còn {editing.productCount} sản phẩm — chuyển sang danh mục khác trước khi xóa.</span>
          )}
        </form>
      </Card>
    </div>
  );
}
