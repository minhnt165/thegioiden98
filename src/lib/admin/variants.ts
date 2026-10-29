// Bảng phân loại: sinh tổ hợp từ các nhóm (Màu chao × Kích cỡ), giữ lại dữ liệu cũ khi sửa nhóm.
// Hàm thuần, không phụ thuộc React — dùng được ở client và test riêng.

import { foldVietnamese } from "@/lib/shop/filters";

export type OptionDraft = { name: string; values: { value: string; hex: string | null }[] };
export type VariantDraft = {
  id: string | null;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  optionValues: Record<string, string>;
};

function sameCombo(a: Record<string, string>, b: Record<string, string>, names: string[]) {
  return names.every((n) => a[n] === b[n]);
}

/** Tích Descartes các giá trị: [{Màu: Đen, Cỡ: Nhỏ}, {Màu: Đen, Cỡ: Vừa}, …] theo thứ tự nhóm */
export function combinations(options: OptionDraft[]): Record<string, string>[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length);
  return usable.reduce<Record<string, string>[]>(
    (acc, option) => acc.flatMap((combo) => option.values.map((v) => ({ ...combo, [option.name]: v.value }))),
    [{}],
  );
}

/** "Đen than" → "DT", "Kem" → "KEM", "Nhỏ · cao 38 cm" → "N38" */
export function abbreviate(value: string): string {
  const words = foldVietnamese(value).toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (!words.length) return "X";
  if (words.length === 1) return words[0].slice(0, 3);
  const digits = words.filter((w) => /^\d+$/.test(w)).join("");
  return (words.filter((w) => !/^\d+$/.test(w)).map((w) => w[0]).join("").slice(0, 3) + digits).slice(0, 5);
}

/** "Đèn bàn Mộc" → "DBM" */
export function skuBaseFromName(name: string): string {
  const words = foldVietnamese(name).toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  return words.map((w) => w[0]).join("").slice(0, 5) || "SP";
}

export function buildSku(base: string, combo: Record<string, string>, options: OptionDraft[]): string {
  const parts = options.filter((o) => combo[o.name]).map((o) => abbreviate(combo[o.name]));
  return [base.trim().toUpperCase() || "SP", ...parts].join("-");
}

/** SKU không trùng trong bảng: thêm -2, -3… khi cần */
function uniqueSku(sku: string, taken: Set<string>): string {
  let candidate = sku;
  for (let i = 2; taken.has(candidate.toUpperCase()); i++) candidate = `${sku}-${i}`;
  taken.add(candidate.toUpperCase());
  return candidate;
}

/**
 * Dựng lại bảng phân loại sau khi đổi nhóm/giá trị. Dòng nào trùng tổ hợp cũ thì giữ nguyên
 * id, SKU, giá, tồn; dòng mới lấy giá mặc định, tồn 0.
 */
export function rebuildVariants(
  options: OptionDraft[],
  previous: VariantDraft[],
  defaults: { price: number; skuBase: string },
): VariantDraft[] {
  const names = options.filter((o) => o.name.trim() && o.values.length).map((o) => o.name);
  const combos = combinations(options);
  const taken = new Set<string>();
  const reused = combos.map((combo) => previous.find((v) => sameCombo(v.optionValues, combo, names) && Object.keys(v.optionValues).length === names.length));
  // Sản phẩm đang không phân loại (1 dòng mặc định) vừa thêm nhóm đầu tiên: dòng cũ thành tổ hợp đầu, không mất SKU/tồn
  if (names.length && previous.length === 1 && !Object.keys(previous[0].optionValues).length && !reused.some(Boolean)) {
    reused[0] = previous[0];
  }
  reused.forEach((v) => v && taken.add(v.sku.toUpperCase()));

  // Không còn nhóm nào: giữ 1 dòng mặc định (ưu tiên dòng cũ để không mất tồn kho/SKU)
  if (!names.length) {
    const keep = previous[0];
    return [
      keep
        ? { ...keep, optionValues: {} }
        : { id: null, sku: uniqueSku(defaults.skuBase.toUpperCase() || "SP", taken), price: defaults.price, stock: 0, isActive: true, optionValues: {} },
    ];
  }

  return combos.map((combo, i) => {
    const old = reused[i];
    if (old) {
      // Dòng mặc định của sản phẩm mới chưa có SKU: sinh luôn theo tổ hợp
      const sku = old.sku.trim() ? old.sku : uniqueSku(buildSku(defaults.skuBase, combo, options), taken);
      return { ...old, sku, optionValues: combo };
    }
    return {
      id: null,
      sku: uniqueSku(buildSku(defaults.skuBase, combo, options), taken),
      price: defaults.price,
      stock: 0,
      isActive: true,
      optionValues: combo,
    };
  });
}

/** Đổi tên nhóm: cập nhật khóa trong option_values để không mất dữ liệu các dòng */
export function renameOptionKey(variants: VariantDraft[], from: string, to: string): VariantDraft[] {
  if (from === to) return variants;
  return variants.map((v) => {
    if (!(from in v.optionValues)) return v;
    const { [from]: value, ...rest } = v.optionValues;
    return { ...v, optionValues: { ...rest, [to]: value } };
  });
}

/** Đổi tên một giá trị trong nhóm (vd "Kem" → "Kem lanh") */
export function renameOptionValue(variants: VariantDraft[], option: string, from: string, to: string): VariantDraft[] {
  if (from === to) return variants;
  return variants.map((v) => (v.optionValues[option] === from ? { ...v, optionValues: { ...v.optionValues, [option]: to } } : v));
}

/** Nhãn hiển thị một dòng: "Đen than · Nhỏ" */
export function variantLabel(v: VariantDraft, options: OptionDraft[]): string {
  return options.map((o) => v.optionValues[o.name]).filter(Boolean).join(" · ") || "Mặc định";
}

/** Tiền tố SKU chung của các dòng: ["DBM-DEN-N", "DBM-KEM-V"] → "DBM" */
export function commonSkuBase(variants: VariantDraft[]): string {
  if (!variants.length) return "";
  let prefix = variants[0].sku;
  for (const v of variants.slice(1)) while (!v.sku.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.replace(/[-_]+$/, "");
}
