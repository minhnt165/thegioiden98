"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveProduct, setProductsStatus } from "@/app/admin/(panel)/san-pham/actions";
import { formatDate } from "@/lib/format";
import type { ProductFormData } from "@/lib/admin/products";
import { buildSku, commonSkuBase, skuBaseFromName, variantLabel, type OptionDraft, type VariantDraft } from "@/lib/admin/variants";
import { COLORS, MATERIALS, SPACES } from "@/lib/shop/filters";
import { slugify } from "@/lib/slug";
import type { Enums } from "@/types/database";
import { BTN_PRIMARY, BTN_SECONDARY, Card, INPUT, LABEL, PageHeader } from "../ui";
import { ImageManager, MAX_IMAGES, type ImageItem } from "./ImageManager";
import { MoneyInput } from "./MoneyInput";
import { RichTextEditor } from "./RichTextEditor";
import { VariantEditor } from "./VariantEditor";

type Props = {
  initial: ProductFormData;
  /** id tạo sẵn cho sản phẩm mới (ảnh tải lên trước khi lưu nằm trong thư mục này) */
  newId: string;
  categories: { id: string; label: string }[];
};

type Status = Enums<"product_status">;

const CHIP = "inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-cream";

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Phân loại đã lưu trong DB (để biết lần lưu tới sẽ xóa dòng nào còn hàng) */
type SavedVariant = { id: string; label: string; stock: number };

const savedOf = (variants: VariantDraft[], options: OptionDraft[]): SavedVariant[] =>
  variants.flatMap((v) => (v.id ? [{ id: v.id, label: variantLabel(v, options), stock: v.stock }] : []));

export function ProductForm({ initial, newId, categories }: Props) {
  const router = useRouter();
  const isNew = initial.id === null;
  const productId = initial.id ?? newId;

  const [form, setForm] = useState(() => ({
    name: initial.name,
    slug: initial.slug,
    categoryId: initial.categoryId,
    description: initial.description,
    material: initial.material,
    dimensions: initial.dimensions,
    bulb: initial.bulb,
    extraSpecs: initial.extraSpecs,
    careInstructions: initial.careInstructions,
    defaultPrice: initial.basePrice,
    compareAtPrice: initial.compareAtPrice,
    status: initial.status,
    isFeatured: initial.isFeatured,
    badge: initial.badge,
    lowStockThreshold: initial.lowStockThreshold,
    materialTags: initial.materialTags,
    colorTags: initial.colorTags,
    spaces: initial.spaces,
    seoDescription: initial.seoDescription,
  }));
  const [options, setOptions] = useState<OptionDraft[]>(initial.options);
  const [variants, setVariants] = useState<VariantDraft[]>(initial.variants);
  const [savedVariants, setSavedVariants] = useState(() => savedOf(initial.variants, initial.options));
  const [images, setImages] = useState<ImageItem[]>(initial.images);
  const [skuBase, setSkuBase] = useState(() => commonSkuBase(initial.variants) || skuBaseFromName(initial.name));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [savedPaths, setSavedPaths] = useState(() => new Set(initial.images.map((i) => i.path)));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totalStock = useMemo(() => variants.filter((v) => v.isActive).reduce((s, v) => s + v.stock, 0), [variants]);

  function submit(status: Status) {
    setMessage(null);
    if (!form.name.trim()) {
      setMessage({ tone: "error", text: "Nhập tên sản phẩm trước khi lưu." });
      return;
    }
    // Phân loại còn hàng sắp bị xóa (kể cả do đổi nhóm phân loại): tồn bị trừ khỏi kho, phải xác nhận
    const keptIds = new Set(variants.map((v) => v.id));
    const removed = savedVariants.filter((v) => v.stock > 0 && !keptIds.has(v.id));
    if (
      removed.length &&
      !window.confirm(
        `Lưu sẽ xóa ${removed.length} phân loại còn hàng, số tồn này bị trừ khỏi kho:\n` +
          removed.map((v) => `• ${form.name} – ${v.label}: còn ${v.stock}`).join("\n") +
          "\n\nTiếp tục lưu?",
      )
    ) {
      return;
    }
    // Dòng chưa nhập SKU: tự sinh từ SKU gốc + giá trị phân loại. Gửi SKU đã cắt khoảng trắng như server lưu,
    // để ghép lại id theo SKU sau khi lưu không trượt
    const sent = variants.map((v) => ({ ...v, sku: v.sku.trim() || buildSku(skuBase, v.optionValues, options) }));
    startTransition(async () => {
      const result = await saveProduct({
        id: productId,
        name: form.name,
        slug: form.slug || slugify(form.name),
        categoryId: form.categoryId,
        description: form.description,
        material: form.material,
        dimensions: form.dimensions,
        bulb: form.bulb,
        extraSpecs: form.extraSpecs,
        careInstructions: form.careInstructions,
        compareAtPrice: form.compareAtPrice,
        status,
        isFeatured: form.isFeatured,
        badge: form.badge,
        lowStockThreshold: form.lowStockThreshold,
        materialTags: form.materialTags,
        colorTags: form.colorTags,
        spaces: form.spaces,
        seoDescription: form.seoDescription,
        options,
        variants: sent,
        images,
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      // Gắn id + tồn thật (theo SKU) cho các dòng: lần lưu sau cập nhật đúng dòng, không xóa rồi tạo lại
      const bySku = new Map(result.data.variants.map((v) => [v.sku.trim().toUpperCase(), v]));
      const synced = sent.map((v) => {
        const saved = bySku.get(v.sku.trim().toUpperCase());
        return saved ? { ...v, id: saved.id, stock: saved.stock } : v;
      });
      setVariants(synced);
      setSavedVariants(savedOf(synced, options));
      setForm((f) => ({ ...f, status, slug: result.data.slug }));
      setSavedPaths(new Set(images.map((i) => i.path)));
      setDirty(false);
      setMessage({ tone: "ok", text: status === "active" ? "Đã lưu và đăng bán." : "Đã lưu." });
      if (isNew) router.replace(`/admin/san-pham/${result.data.id}`);
      router.refresh();
    });
  }

  function stopSelling() {
    if (!initial.id || !window.confirm("Ẩn sản phẩm khỏi cửa hàng? Sản phẩm vẫn được giữ lại cùng lịch sử đơn hàng.")) return;
    startTransition(async () => {
      const result = await setProductsStatus([initial.id!], "hidden");
      if (!result.ok) setMessage({ tone: "error", text: result.error });
      else {
        setForm((f) => ({ ...f, status: "hidden" }));
        setMessage({ tone: "ok", text: "Đã ẩn sản phẩm khỏi cửa hàng." });
        router.refresh();
      }
    });
  }

  const primaryLabel = form.status === "active" ? "Lưu & đăng bán" : "Lưu thay đổi";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(form.status);
      }}
      className="flex flex-col gap-5"
    >
      <PageHeader
        title={isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"}
        breadcrumb={[{ href: "/admin/san-pham", label: "Sản phẩm" }, ...(isNew ? [] : [{ href: `/admin/san-pham/${productId}`, label: initial.name }])]}
        actions={
          <>
            {!isNew && initial.status === "active" && (
              <a href={`/san-pham/${form.slug}`} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                Xem trên web
              </a>
            )}
            {form.status !== "draft" && (
              <button type="button" disabled={pending} onClick={() => submit("draft")} className={BTN_SECONDARY}>
                Lưu nháp
              </button>
            )}
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? "Đang lưu…" : primaryLabel}
            </button>
          </>
        }
      />

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-input px-4 py-3 text-[14px] ${message.tone === "error" ? "bg-status-red-bg text-status-red" : "bg-status-green-bg text-status-green"}`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        {/* Cột trái */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Card title="Hình ảnh" aside={<span className="text-[12px] text-muted">Tối đa {MAX_IMAGES} ảnh · ảnh đầu là ảnh bìa · nên dùng tỉ lệ 1:1</span>}>
            <ImageManager
              productId={productId}
              images={images}
              savedPaths={savedPaths}
              onChange={(next) => {
                setImages(next);
                setDirty(true);
              }}
            />
          </Card>

          <Card title="Thông tin cơ bản">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ten" className={LABEL}>
                Tên sản phẩm
              </label>
              <input
                id="ten"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => {
                  update("name", e.target.value);
                  if (!slugTouched) update("slug", slugify(e.target.value));
                  if (isNew && !variants.some((v) => v.id)) setSkuBase(skuBaseFromName(e.target.value));
                }}
                className={INPUT}
              />
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="dm" className={LABEL}>
                  Danh mục
                </label>
                <select id="dm" value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} className={INPUT}>
                  <option value="">— Chưa chọn —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sku" className={LABEL}>
                  SKU gốc <span className="text-[12px]">(tiền tố khi tạo SKU phân loại)</span>
                </label>
                <input id="sku" value={skuBase} onChange={(e) => setSkuBase(e.target.value.toUpperCase().replace(/\s+/g, ""))} className={INPUT} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mota" className={LABEL}>
                Mô tả <span className="text-[12px]">(đoạn đầu hiện thành câu trích dẫn ở mục “Câu chuyện”)</span>
              </label>
              <RichTextEditor id="mota" value={form.description} onChange={(html) => update("description", html)} />
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {(
                [
                  ["material", "Chất liệu", "Gỗ sồi · vải lanh"],
                  ["dimensions", "Kích thước", "Ø 28 × cao 38 cm"],
                  ["bulb", "Bóng đèn", "E27 · tối đa 40 W"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={key} className={LABEL}>
                    {label}
                  </label>
                  <input id={key} value={form[key]} placeholder={placeholder} onChange={(e) => update(key, e.target.value)} className={INPUT} />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span className={LABEL}>Thông số thêm (hiện trong bảng thông số)</span>
              {form.extraSpecs.map((spec, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={spec.label}
                    placeholder="Dây & công tắc"
                    aria-label={`Tên thông số ${i + 1}`}
                    onChange={(e) => update("extraSpecs", form.extraSpecs.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))}
                    className={`${INPUT} sm:w-56`}
                  />
                  <input
                    value={spec.value}
                    placeholder="Dây vải 1,8 m · công tắc trên dây"
                    aria-label={`Giá trị thông số ${i + 1}`}
                    onChange={(e) => update("extraSpecs", form.extraSpecs.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))}
                    className={INPUT}
                  />
                  <button
                    type="button"
                    aria-label="Xóa thông số"
                    onClick={() => update("extraSpecs", form.extraSpecs.filter((_, j) => j !== i))}
                    className="flex size-11 shrink-0 items-center justify-center rounded-input border border-line text-muted hover:text-status-red"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update("extraSpecs", [...form.extraSpecs, { label: "", value: "" }])}
                className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink"
              >
                <Plus aria-hidden className="size-4" /> Thêm thông số
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="baoquan" className={LABEL}>
                Bảo quản (hiện trong mục “Giao hàng &amp; bảo quản”)
              </label>
              <textarea
                id="baoquan"
                rows={2}
                maxLength={500}
                value={form.careInstructions}
                onChange={(e) => update("careInstructions", e.target.value)}
                placeholder="Lau chao bằng khăn khô; thân gỗ tránh nước và nắng gắt."
                className={`${INPUT} h-auto py-2.5`}
              />
            </div>
          </Card>

          <Card title="Phân loại hàng">
            <VariantEditor
              options={options}
              variants={variants}
              skuBase={skuBase}
              defaultPrice={form.defaultPrice}
              onChange={(nextOptions, nextVariants) => {
                setOptions(nextOptions);
                setVariants(nextVariants);
                setDirty(true);
              }}
              onStockAdjusted={(id, stock) => {
                setVariants((list) => list.map((v) => (v.id === id ? { ...v, stock } : v)));
                setSavedVariants((list) => list.map((v) => (v.id === id ? { ...v, stock } : v)));
                router.refresh(); // khối "Lịch sử kho" dưới form có dòng mới
              }}
            />
          </Card>
        </div>

        {/* Cột phải */}
        <div className="flex w-full flex-col gap-5 xl:w-85 xl:shrink-0">
          <Card title="Trạng thái">
            <fieldset className="flex flex-col gap-1">
              <legend className="sr-only">Trạng thái</legend>
              {(
                [
                  ["active", "Đang bán"],
                  ["hidden", "Ẩn khỏi cửa hàng"],
                  ["draft", "Nháp"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-8 items-center gap-2.5 text-[14px]">
                  <input type="radio" name="status" checked={form.status === value} onChange={() => update("status", value)} className="size-4.5 accent-ink" />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1 border-t border-line-soft pt-3">
              <label className="flex min-h-8 items-center gap-2.5 text-[14px]">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => update("isFeatured", e.target.checked)} className="size-4.5 accent-ink" />
                Hiện ở “Sản phẩm nổi bật”
              </label>
              <label className="flex min-h-8 items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  checked={form.badge === "bestseller"}
                  onChange={(e) => update("badge", e.target.checked ? "bestseller" : "none")}
                  className="size-4.5 accent-ink"
                />
                Nhãn “Bán chạy”
              </label>
              <label className="flex min-h-8 items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  checked={form.badge === "new"}
                  onChange={(e) => update("badge", e.target.checked ? "new" : "none")}
                  className="size-4.5 accent-ink"
                />
                Nhãn “Mới”
              </label>
              <span className="text-[12px] text-muted">Mỗi sản phẩm hiện một nhãn.</span>
            </div>
          </Card>

          <Card title="Giá & kho mặc định">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gia" className={LABEL}>
                Giá bán mặc định (₫)
              </label>
              <MoneyInput
                id="gia"
                value={form.defaultPrice}
                onChange={(v) => {
                  const next = v ?? 0;
                  // Dòng nào vẫn đang giữ giá mặc định cũ (chưa sửa riêng) thì đổi theo
                  setVariants((vs) => vs.map((x) => (x.price === form.defaultPrice ? { ...x, price: next } : x)));
                  update("defaultPrice", next);
                }}
              />
              <span className="text-[12px] text-muted">Dùng cho phân loại mới thêm. Giá “từ” trên cửa hàng = giá thấp nhất trong các phân loại.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="giacu" className={LABEL}>
                Giá gạch (tùy chọn)
              </label>
              <MoneyInput
                id="giacu"
                allowEmpty
                value={form.compareAtPrice}
                placeholder="Để trống nếu không giảm giá"
                onChange={(v) => update("compareAtPrice", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ton" className={LABEL}>
                  Tổng tồn
                </label>
                <input id="ton" value={totalStock} readOnly className={`${INPUT} bg-cream`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="canh" className={LABEL}>
                  Cảnh báo khi ≤
                </label>
                <input
                  id="canh"
                  type="number"
                  min={0}
                  placeholder="Mặc định"
                  value={form.lowStockThreshold ?? ""}
                  onChange={(e) => update("lowStockThreshold", e.target.value === "" ? null : Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                  className={INPUT}
                />
              </div>
            </div>
          </Card>

          <Card title="Bộ lọc trên cửa hàng">
            {(
              [
                ["materialTags", "Chất liệu", MATERIALS],
                ["spaces", "Không gian", SPACES],
              ] as const
            ).map(([key, label, items]) => (
              <fieldset key={key} className="flex flex-col gap-2">
                <legend className={`${LABEL} mb-2`}>{label}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <label key={item.value} className={`${CHIP} border-line`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form[key].includes(item.value)}
                        onChange={() => update(key, toggleIn(form[key], item.value))}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset className="flex flex-col gap-2">
              <legend className={`${LABEL} mb-2`}>Nhóm màu</legend>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <label key={c.value} className={`${CHIP} border-line`}>
                    <input type="checkbox" className="sr-only" checked={form.colorTags.includes(c.value)} onChange={() => update("colorTags", toggleIn(form.colorTags, c.value))} />
                    <span className="size-3.5 rounded-full border border-line" style={{ background: c.hex }} />
                    {c.label.replace("Màu ", "").replace(/^./, (ch) => ch.toUpperCase())}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card title="Đường dẫn & SEO">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slug" className={LABEL}>
                Đường dẫn
              </label>
              <div className="flex items-center rounded-input border border-line bg-white focus-within:border-ink">
                <span className="pl-3.5 text-[13px] text-muted">/san-pham/</span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  onBlur={() => update("slug", slugify(form.slug) || slugify(form.name))}
                  className="h-11 min-w-0 flex-1 bg-transparent pr-3.5 text-[14px] outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo" className={LABEL}>
                Mô tả ngắn (dưới tên sản phẩm & trên Google)
              </label>
              <textarea
                id="seo"
                rows={3}
                maxLength={300}
                value={form.seoDescription}
                onChange={(e) => update("seoDescription", e.target.value)}
                className={`${INPUT} h-auto py-2.5`}
              />
              <span className="text-right text-[12px] text-muted">{form.seoDescription.length}/160 ký tự hiện trên Google</span>
            </div>
          </Card>

          {!isNew && (
            <Card title="Lịch sử">
              <span className="text-[13px] text-muted">Tạo: {formatDate(initial.createdAt)}</span>
              <span className="text-[13px] text-muted">Sửa gần nhất: {formatDate(initial.updatedAt)}</span>
              {form.status !== "hidden" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={stopSelling}
                  className="mt-1 h-10 rounded-input border border-line text-[13px] text-status-red hover:border-status-red"
                >
                  Ngừng bán (ẩn sản phẩm)
                </button>
              )}
              <span className="text-[12px] text-muted">Sản phẩm không bị xóa hẳn để giữ lịch sử đơn hàng và báo giá.</span>
            </Card>
          )}

          <Link href="/admin/san-pham" className="text-center text-[13px] text-muted hover:text-ink">
            ← Về danh sách sản phẩm
          </Link>
        </div>
      </div>
    </form>
  );
}
