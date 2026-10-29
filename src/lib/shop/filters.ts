// Bộ lọc danh sách sản phẩm: định nghĩa, đọc từ URL, áp dụng trên catalog. Không phụ thuộc server.

export const MATERIALS = [
  { value: "go", label: "Gỗ" },
  { value: "gom", label: "Gốm" },
  { value: "kim-loai", label: "Kim loại" },
  { value: "thuy-tinh", label: "Thủy tinh" },
  { value: "vai-may-tre", label: "Vải & mây tre" },
] as const;

export const COLORS = [
  { value: "den", label: "Màu đen", hex: "#1B1916" },
  { value: "kem", label: "Màu kem", hex: "#F6E8C9" },
  { value: "go", label: "Màu gỗ", hex: "#B8612A" },
  { value: "xanh-reu", label: "Màu xanh rêu", hex: "#6B7A5E" },
  { value: "dong", label: "Màu đồng", hex: "#C8A26A" },
] as const;

export const PRICE_RANGES = [
  { value: "duoi-1tr", label: "Dưới 1.000.000₫", min: 0, max: 1_000_000 },
  { value: "1-3tr", label: "1.000.000₫ – 3.000.000₫", min: 1_000_000, max: 3_000_000 },
  { value: "3-6tr", label: "3.000.000₫ – 6.000.000₫", min: 3_000_000, max: 6_000_000 },
  { value: "tren-6tr", label: "Trên 6.000.000₫", min: 6_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export const AVAILABILITY = [
  { value: "con-hang", label: "Còn hàng" },
  { value: "dat-truoc", label: "Đặt trước" },
] as const;

export const SPACES = [
  { value: "phong-khach", label: "Phòng khách", hint: "Đèn sàn · Ghế thư giãn · Bàn trà" },
  { value: "phong-ngu", label: "Phòng ngủ", hint: "Đèn ngủ · Đèn đầu giường · Bình gốm" },
  { value: "goc-lam-viec", label: "Góc làm việc", hint: "Đèn bàn · Ghế · Kệ nhỏ" },
] as const;

export const SORTS = [
  { value: "noi-bat", label: "Nổi bật" },
  { value: "moi-nhat", label: "Mới nhất" },
  { value: "gia-tang", label: "Giá thấp → cao" },
  { value: "gia-giam", label: "Giá cao → thấp" },
] as const;

export const PAGE_SIZE = 12;

type Values<T extends readonly { value: string }[]> = T[number]["value"];

export type ListingFilters = {
  materials: Values<typeof MATERIALS>[];
  colors: Values<typeof COLORS>[];
  price: Values<typeof PRICE_RANGES> | null;
  availability: Values<typeof AVAILABILITY>[];
  space: Values<typeof SPACES> | null;
  q: string;
  sort: Values<typeof SORTS>;
  page: number;
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function pickList<T extends readonly { value: string }[]>(raw: string, options: T): Values<T>[] {
  const allowed = new Set(options.map((o) => o.value));
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is Values<T> => allowed.has(v));
}

function pickOne<T extends readonly { value: string }[]>(raw: string, options: T): Values<T> | null {
  return options.some((o) => o.value === raw) ? (raw as Values<T>) : null;
}

/** Đọc bộ lọc từ query string; giá trị lạ bị bỏ qua */
export function parseFilters(params: SearchParamsRecord): ListingFilters {
  const page = Number.parseInt(first(params.trang), 10);
  return {
    materials: pickList(first(params["chat-lieu"]), MATERIALS),
    colors: pickList(first(params.mau), COLORS),
    price: pickOne(first(params.gia), PRICE_RANGES),
    availability: pickList(first(params["tinh-trang"]), AVAILABILITY),
    space: pickOne(first(params["khong-gian"]), SPACES),
    q: first(params.q).trim().slice(0, 80),
    sort: pickOne(first(params["sap-xep"]), SORTS) ?? "noi-bat",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Dựng lại query string (bỏ giá trị mặc định) */
export function filtersToSearch(filters: ListingFilters): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.space) sp.set("khong-gian", filters.space);
  if (filters.materials.length) sp.set("chat-lieu", filters.materials.join(","));
  if (filters.price) sp.set("gia", filters.price);
  if (filters.colors.length) sp.set("mau", filters.colors.join(","));
  if (filters.availability.length) sp.set("tinh-trang", filters.availability.join(","));
  if (filters.sort !== "noi-bat") sp.set("sap-xep", filters.sort);
  if (filters.page > 1) sp.set("trang", String(filters.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return Boolean(
    filters.materials.length ||
      filters.colors.length ||
      filters.price ||
      filters.availability.length ||
      filters.space ||
      filters.q,
  );
}

/** Bỏ dấu tiếng Việt để tìm "den ban" ra "Đèn bàn" */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

type FilterableProduct = {
  name: string;
  material: string | null;
  categoryName: string | null;
  basePrice: number;
  stock: number;
  isFeatured: boolean;
  badge: string;
  createdAt: string;
  materialTags: string[];
  colorTags: string[];
  spaces: string[];
};

const BADGE_RANK: Record<string, number> = { bestseller: 2, new: 1 };

export function applyFilters<T extends FilterableProduct>(products: T[], filters: ListingFilters): T[] {
  const priceRange = PRICE_RANGES.find((r) => r.value === filters.price);
  const query = foldVietnamese(filters.q);
  const wantInStock = filters.availability.includes("con-hang");
  const wantPreorder = filters.availability.includes("dat-truoc");

  const result = products.filter((p) => {
    if (filters.materials.length && !filters.materials.some((m) => p.materialTags.includes(m))) return false;
    if (filters.colors.length && !filters.colors.some((c) => p.colorTags.includes(c))) return false;
    if (filters.space && !p.spaces.includes(filters.space)) return false;
    if (priceRange && (p.basePrice < priceRange.min || p.basePrice >= priceRange.max)) return false;
    if (wantInStock !== wantPreorder) {
      if (wantInStock && p.stock <= 0) return false;
      if (wantPreorder && p.stock > 0) return false;
    }
    if (query) {
      const haystack = foldVietnamese(`${p.name} ${p.material ?? ""} ${p.categoryName ?? ""}`);
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const byNewest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  switch (filters.sort) {
    case "moi-nhat":
      return result.sort(byNewest);
    case "gia-tang":
      return result.sort((a, b) => a.basePrice - b.basePrice);
    case "gia-giam":
      return result.sort((a, b) => b.basePrice - a.basePrice);
    default:
      return result.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (BADGE_RANK[b.badge] ?? 0) - (BADGE_RANK[a.badge] ?? 0) ||
          byNewest(a, b),
      );
  }
}

export function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: current,
    totalPages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, items.length),
  };
}
