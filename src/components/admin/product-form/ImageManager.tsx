"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const MAX_IMAGES = 9;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type ImageItem = { path: string };

function publicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;
}

type Props = {
  productId: string;
  images: ImageItem[];
  /** Ảnh đã có trong DB lúc mở form — gỡ ảnh này thì đợi lưu mới xóa file */
  savedPaths: Set<string>;
  onChange: (images: ImageItem[]) => void;
};

/** Ảnh sản phẩm: tối đa 9, ảnh đầu là ảnh bìa; tải thẳng lên Supabase Storage (bucket "products") */
export function ImageManager({ productId, images, savedPaths, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const slots = MAX_IMAGES - images.length - uploading;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const picked = [...files].slice(0, Math.max(slots, 0));
    const problems: string[] = [];
    if (files.length > picked.length) problems.push(`Chỉ thêm được ${MAX_IMAGES} ảnh mỗi sản phẩm.`);

    const valid = picked.filter((f) => {
      if (!ACCEPT.includes(f.type)) problems.push(`${f.name}: chỉ nhận JPG, PNG, WebP, AVIF.`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name}: ảnh lớn hơn 5 MB.`);
      else return true;
      return false;
    });

    setUploading((n) => n + valid.length);
    const supabase = createClient();
    const added: ImageItem[] = [];
    for (const file of valid) {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("products").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) problems.push(`${file.name}: ${uploadError.message}`);
      else added.push({ path });
      setUploading((n) => n - 1);
    }
    if (added.length) onChange([...images, ...added]);
    if (problems.length) setError(problems.join(" "));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(index: number) {
    const target = images[index];
    onChange(images.filter((_, i) => i !== index));
    // Ảnh mới tải trong phiên này: xóa file ngay. Ảnh đã lưu: Server Action xóa khi bấm Lưu.
    if (!savedPaths.has(target.path)) {
      const { error: removeError } = await createClient().storage.from("products").remove([target.path]);
      if (removeError) console.error("Không xóa được ảnh tạm:", removeError);
    }
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {images.map((img, i) => (
          <li key={img.path} className="group relative aspect-square overflow-hidden rounded-[10px] bg-swatch-1">
            <Image src={publicUrl(img.path)} alt={`Ảnh ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-cream">Ảnh bìa</span>
            )}
            <div className="absolute inset-x-1 top-1 flex justify-between opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <div className="flex gap-1">
                {i > 0 && (
                  <button type="button" aria-label="Đặt làm ảnh bìa" title="Đặt làm ảnh bìa" onClick={() => move(i, 0)} className="flex size-7 items-center justify-center rounded-full bg-white/90">
                    <Star aria-hidden className="size-3.5" />
                  </button>
                )}
              </div>
              <button type="button" aria-label={`Gỡ ảnh ${i + 1}`} onClick={() => remove(i)} className="flex size-7 items-center justify-center rounded-full bg-white/90 text-status-red">
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <button type="button" aria-label="Lên trước" disabled={i === 0} onClick={() => move(i, i - 1)} className="flex size-7 items-center justify-center rounded-full bg-white/90 disabled:hidden">
                <ArrowLeft aria-hidden className="size-3.5" />
              </button>
              <button type="button" aria-label="Ra sau" disabled={i === images.length - 1} onClick={() => move(i, i + 1)} className="flex size-7 items-center justify-center rounded-full bg-white/90 disabled:hidden">
                <ArrowRight aria-hidden className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-[10px] bg-cream text-[12px] text-muted">
            <Loader2 aria-hidden className="mr-1.5 size-4 animate-spin" /> Đang tải
          </li>
        ))}
        {slots > 0 && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-dashed text-[12px] text-muted hover:border-ink hover:text-ink">
              <ImagePlus aria-hidden className="size-5" strokeWidth={1.6} />
              Thêm ảnh
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => upload(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      {error && (
        <p role="alert" className="rounded-input bg-status-red-bg px-3 py-2 text-[13px] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
