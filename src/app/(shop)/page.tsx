import Image from "next/image";
import Link from "next/link";
import { ProductArt, artKindFor } from "@/components/shop/ProductArt";
import { ProductCard } from "@/components/shop/ProductCard";
import { HOME_CATEGORIES } from "@/components/shop/nav";
import { getCatalog, productImageUrl, type CatalogProduct } from "@/lib/shop/catalog";
import { GENERAL_MESSAGE, messengerLink, zaloLink } from "@/lib/shop/contact";
import { COLORS, SPACES, applyFilters, parseFilters } from "@/lib/shop/filters";
import { getShopSettings } from "@/lib/shop/settings";

// Icon 5 ô danh mục (nét mảnh, theo mockup)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "den-ban": (
    <>
      <path d="M12 5h12l4 13H8z" />
      <path d="M18 18v10M11 29h14" />
    </>
  ),
  "den-san": (
    <>
      <path d="M14 4h8l3 9H11z" />
      <path d="M18 13v18M12 31h12" />
    </>
  ),
  "den-tha": (
    <>
      <path d="M18 3v12" />
      <path d="M9 15h18l3 10H6z" />
      <circle cx="18" cy="29" r="3" />
    </>
  ),
  "ghe-ban": (
    <>
      <path d="M9 6v14h18V6" />
      <path d="M6 20h24" />
      <path d="M9 20v10M27 20v10" />
    </>
  ),
  "do-decor": (
    <>
      <path d="M14 4h8l-2 8c6 2 7 8 7 12H9c0-4 1-10 7-12z" />
      <path d="M9 28h18v4H9z" />
    </>
  ),
};

const SPACE_TINTS = ["bg-swatch-1", "bg-swatch-2", "bg-swatch-3"];

const STEPS = [
  { title: "Chọn món bạn thích", text: "Xem kích thước, chất liệu và ảnh thật của từng sản phẩm." },
  { title: "Nhắn Zalo hoặc Messenger", text: "Bấm nút trên trang sản phẩm, tin nhắn đã có sẵn tên món bạn chọn." },
  { title: "Nhận hàng tận nơi", text: "Shop xác nhận, đóng gói kỹ và giao đến bạn." },
];

/**
 * 2 món tiêu biểu của một không gian ở góc trên ô "Mua sắm theo không gian":
 * ảnh bìa thật nếu sản phẩm đã có ảnh, chưa có thì dùng hình minh họa theo loại (không trùng loại).
 */
function SpacePreview({ picks }: { picks: CatalogProduct[] }) {
  if (!picks.length) return null;

  return (
    <div aria-hidden className="absolute right-4 top-4 flex h-[62%] items-end gap-2 md:right-6 md:top-6 md:h-[58%] md:gap-3">
      {picks.map((p, i) =>
        p.coverPath ? (
          <span key={p.id} className={`relative aspect-3/4 overflow-hidden rounded-2xl ${i === 0 ? "h-full" : "h-4/5"}`}>
            <Image src={productImageUrl(p.coverPath)} alt="" fill sizes="200px" className="object-cover" />
          </span>
        ) : (
          <ProductArt
            key={p.id}
            kind={artKindFor(p.categorySlug, p.name)}
            shade={shadeFor(p)}
            className={`w-auto transition-transform duration-500 group-hover:-translate-y-1 ${i === 0 ? "h-full" : "h-3/4"}`}
          />
        ),
      )}
    </div>
  );
}

/**
 * Chọn 2 món cho mỗi không gian: ưu tiên món chưa hiện ở ô trước và khác loại nhau,
 * để 3 ô không lặp cùng một hình.
 */
function pickSpacePreviews(catalog: CatalogProduct[]) {
  const usedIds = new Set<string>();
  const usedKinds = new Set<string>();
  return SPACES.map((space) => {
    // Món chưa dùng & loại hình chưa dùng lên trước, giữ thứ tự "nổi bật" khi bằng điểm
    const penalty = (p: CatalogProduct) => Number(usedIds.has(p.id)) * 2 + Number(usedKinds.has(artKindFor(p.categorySlug, p.name)));
    const ranked = applyFilters(
      catalog.filter((p) => p.spaces.includes(space.value)),
      parseFilters({}),
    ).sort((a, b) => penalty(a) - penalty(b));
    const picks: CatalogProduct[] = [];
    const kinds = new Set<string>();
    for (const p of ranked) {
      const kind = artKindFor(p.categorySlug, p.name);
      if (kinds.has(kind) && !p.coverPath) continue;
      kinds.add(kind);
      picks.push(p);
      if (picks.length === 2) break;
    }
    picks.forEach((p) => {
      usedIds.add(p.id);
      usedKinds.add(artKindFor(p.categorySlug, p.name));
    });
    return picks;
  });
}

/** Màu chao của hình minh họa theo nhóm màu đầu tiên của sản phẩm (đồng, đen…) */
function shadeFor(product: CatalogProduct): string | undefined {
  const hex = COLORS.find((c) => c.value === product.colorTags[0])?.hex;
  // Kem/nhạt quá thì giữ màu than cho rõ hình
  return hex && hex !== "#F6E8C9" ? hex : undefined;
}

function HeroArt({ hero, newest }: { hero: CatalogProduct | undefined; newest: CatalogProduct | undefined }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 md:gap-4">
      <Link
        href={hero ? `/san-pham/${hero.slug}` : "/san-pham"}
        className="relative col-span-2 flex h-75 items-end justify-center overflow-hidden rounded-[22px] bg-swatch-1 md:h-105 md:rounded-card-lg"
      >
        <svg aria-hidden viewBox="0 0 320 300" className="h-auto w-[78%] max-w-80">
          <ellipse cx="160" cy="150" rx="120" ry="90" fill="#F6E8C9" />
          <path d="M100 60 L220 60 L250 160 L70 160 Z" fill="#1B1916" />
          <rect x="155" y="160" width="10" height="100" fill="#1B1916" />
          <ellipse cx="160" cy="268" rx="52" ry="11" fill="#1B1916" />
        </svg>
        {hero && (
          <span className="absolute left-5 top-5 text-[12px] uppercase tracking-[0.12em] text-muted">{hero.name}</span>
        )}
      </Link>
      <div className="hidden h-50 items-center justify-center rounded-card-lg bg-swatch-2 md:flex">
        <svg aria-hidden viewBox="0 0 160 160" className="size-30">
          <path d="M34 140 Q34 30 120 30" fill="none" stroke="#1B1916" strokeWidth="6" strokeLinecap="round" />
          <path d="M100 30 L140 30 L150 64 L90 64 Z" fill="#1B1916" />
          <rect x="18" y="138" width="36" height="8" rx="4" fill="#1B1916" />
        </svg>
      </div>
      {newest && (
        <Link
          href={`/san-pham/${newest.slug}`}
          className="hidden h-50 flex-col justify-between rounded-card-lg bg-ink p-6 text-cream hover:text-glow md:flex"
        >
          <span className="text-[12px] uppercase tracking-[0.12em] opacity-70">Mới về</span>
          <span className="font-serif text-[28px] font-light leading-tight">
            {newest.name}
            {newest.material && (
              <>
                <br />
                <em className="text-[0.8em]">{newest.material.toLowerCase()}</em>
              </>
            )}
          </span>
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getShopSettings()]);
  const featured = applyFilters(catalog, parseFilters({})).slice(0, 8);
  const newest = applyFilters(
    catalog.filter((p) => p.badge === "new"),
    parseFilters({ "sap-xep": "moi-nhat" }),
  )[0];
  const contactHref = zaloLink(settings.zaloPhone) ?? messengerLink(settings.messengerUrl, GENERAL_MESSAGE);
  const spacePreviews = pickSpacePreviews(catalog);

  return (
    <>
      {/* Hero */}
      <section className="grid items-end gap-5 px-5 pb-5 pt-7 md:px-12 md:pb-14 md:pt-18 lg:grid-cols-12 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4.5 md:gap-7 lg:col-span-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted md:text-[13px]">Bộ sưu tập mùa Thu — Đông 2026</p>
          <h1 className="font-serif text-[44px] font-light leading-[1.02] tracking-[-0.02em] md:text-[76px]">
            Ánh sáng <br className="hidden md:block" />
            làm nên <em className="font-normal italic text-terracotta">không gian.</em>
          </h1>
          <p className="hidden max-w-115 text-[17px] leading-relaxed text-muted md:block">
            Đèn, ghế, bàn và đồ decor được chọn lọc từ những xưởng thủ công — mỗi món một dáng, đủ đẹp để nhìn cả ngày.
          </p>
          <div className="hidden flex-wrap gap-3 md:flex">
            <Link
              href="/san-pham"
              className="inline-flex h-13 items-center rounded-full bg-ink px-6.5 text-[15px] font-medium text-cream hover:text-glow"
            >
              Khám phá bộ sưu tập
            </Link>
            {contactHref && (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center rounded-full border border-ink px-6.5 text-[15px] font-medium hover:bg-ink hover:text-cream"
              >
                Tư vấn qua Zalo
              </a>
            )}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-6">
          <HeroArt hero={featured[0]} newest={newest} />
        </div>
        <Link
          href="/san-pham"
          className="flex h-13 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-cream md:hidden"
        >
          Khám phá bộ sưu tập
        </Link>
      </section>

      {/* Danh mục: chip cuộn ngang trên mobile, 5 ô trên desktop */}
      <nav aria-label="Danh mục" className="flex gap-2 overflow-x-auto whitespace-nowrap px-5 py-2 md:hidden">
        {HOME_CATEGORIES.map((c, i) => (
          <Link
            key={c.slug}
            href={`/danh-muc/${c.slug}`}
            className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] ${
              i === 0 ? "bg-ink text-cream" : "border border-line bg-white"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <section className="hidden px-12 pb-16 pt-6 md:block">
        <div className="grid grid-cols-5 gap-4">
          {HOME_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/danh-muc/${c.slug}`}
              className="flex min-h-40 flex-col justify-between gap-6 rounded-card border border-line bg-white p-5.5 hover:border-ink"
            >
              <svg
                aria-hidden
                viewBox="0 0 36 36"
                className="size-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                {CATEGORY_ICONS[c.slug]}
              </svg>
              <span className="text-[15px] font-medium">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sản phẩm nổi bật */}
      <section className="flex flex-col gap-4.5 px-5 py-6 md:gap-8 md:px-12 md:pb-20 md:pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-[30px] font-light tracking-[-0.02em] md:text-[44px]">
            <span className="md:hidden">Nổi bật</span>
            <span className="hidden md:inline">Sản phẩm nổi bật</span>
          </h2>
          <Link href="/san-pham" className="text-[14px] font-medium underline underline-offset-4 md:text-[15px]">
            Xem tất cả
          </Link>
        </div>
        {featured.length ? (
          <ul className="grid grid-cols-2 gap-x-3.5 gap-y-7 md:gap-6 lg:grid-cols-4">
            {featured.map((product, i) => (
              <li key={product.id} className={i >= 4 ? "max-md:hidden" : undefined}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-line bg-white p-6 text-[15px] text-muted">
            Sản phẩm đang được cập nhật. Bạn nhắn shop để xem mẫu mới nhất nhé.
          </p>
        )}
      </section>

      {/* Về chúng tôi */}
      <section
        id="ve-chung-toi"
        className="mx-5 grid scroll-mt-6 items-center gap-10 rounded-[22px] bg-ink px-6 py-7 text-cream md:mx-12 md:rounded-4xl md:px-16 md:py-18 lg:grid-cols-12"
      >
        <div className="flex min-w-0 flex-col gap-3.5 md:gap-6 lg:col-span-7">
          <p className="text-[11px] uppercase tracking-[0.14em] opacity-65 md:text-[12px]">Về chúng tôi</p>
          <p className="font-serif text-[26px] font-light leading-[1.15] tracking-[-0.01em] md:text-[48px] md:leading-[1.12] md:tracking-[-0.02em]">
            <span className="hidden md:inline">Chúng tôi tin rằng m</span>
            <span className="md:hidden">M</span>ột chiếc đèn đẹp không chỉ chiếu sáng — nó{" "}
            <em className="text-[#E2A86B]">kể chuyện</em> về căn phòng.
          </p>
          <p className="hidden max-w-130 text-[16px] leading-[1.65] opacity-80 md:block">{settings.aboutText}</p>
          <Link
            href="/san-pham"
            className="inline-flex h-11 items-center self-start rounded-full border border-cream/50 px-4.5 text-[14px] font-medium hover:bg-cream hover:text-ink md:h-12 md:px-5.5"
          >
            Xem bộ sưu tập
          </Link>
        </div>
        <div className="hidden min-w-0 grid-cols-2 gap-4 lg:col-span-5 lg:grid">
          <div className="mt-10 flex aspect-3/4 items-center justify-center rounded-card bg-swatch-3">
            <ProductArt kind="pendant" className="h-auto w-[45%]" />
          </div>
          <div className="mb-10 flex aspect-3/4 items-center justify-center rounded-card bg-swatch-2">
            <ProductArt kind="chair" className="h-auto w-[45%]" />
          </div>
        </div>
      </section>

      {/* Mua sắm theo không gian */}
      <section className="flex flex-col gap-5 px-5 pt-12 md:gap-8 md:px-12 md:py-20">
        <h2 className="font-serif text-[30px] font-light tracking-[-0.02em] md:text-[44px]">Mua sắm theo không gian</h2>
        <div className="grid gap-3.5 md:grid-cols-3 md:gap-6">
          {SPACES.map((space, i) => (
            <Link
              key={space.value}
              href={`/san-pham?khong-gian=${space.value}`}
              className={`group relative flex h-44 flex-col justify-end gap-1.5 overflow-hidden rounded-card-lg p-6 md:h-90 md:p-7 ${SPACE_TINTS[i]}`}
            >
              <SpacePreview picks={spacePreviews[i]} />
              <span className="relative font-serif text-[28px] font-medium group-hover:text-terracotta md:text-[34px]">
                {space.label}
              </span>
              <span className="relative text-[14px] text-muted">{space.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Đặt hàng đơn giản */}
      <section
        id="dat-hang"
        className="mx-5 mt-12 flex scroll-mt-6 flex-col gap-6 md:mx-12 md:mt-0 md:gap-10 md:rounded-4xl md:border md:border-line md:bg-white md:px-16 md:py-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-[30px] font-light tracking-[-0.02em] md:text-[40px]">Đặt hàng đơn giản</h2>
          <p className="hidden text-[15px] text-muted md:block">Chưa cần tài khoản, chưa cần thẻ — chỉ cần nhắn tin.</p>
        </div>
        <ol className="grid gap-3.5 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5 md:flex-col md:gap-3">
              <span className="w-10 shrink-0 font-serif text-[28px] font-light text-terracotta md:w-auto md:text-[48px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-0.5 md:gap-3">
                <span className="text-[15px] font-medium md:text-[18px]">{step.title}</span>
                <span className="text-[14px] leading-relaxed text-muted md:text-[15px]">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
