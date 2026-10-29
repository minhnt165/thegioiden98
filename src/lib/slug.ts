import { foldVietnamese } from "@/lib/shop/filters";

/** "Đèn bàn Mộc" → "den-ban-moc" */
export function slugify(text: string): string {
  return foldVietnamese(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
