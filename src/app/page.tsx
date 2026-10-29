import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { formatVND } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

// Trang chủ tạm (Giai đoạn 1): kiểm tra tokens, font, logo và kết nối Supabase.
// Giai đoạn 2 thay bằng trang chủ đầy đủ theo design/Main.html.

const SWATCHES = ["bg-swatch-1", "bg-swatch-2", "bg-swatch-3", "bg-swatch-4"];

async function getFeaturedProducts() {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, material, base_price")
    .eq("is_featured", true)
    .order("created_at")
    .limit(4);

  if (error) return { products: [], error: error.message };
  return { products: data, error: null };
}

async function FeaturedProducts() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-[15px] leading-relaxed text-muted">
        Chưa kết nối Supabase. Tạo file <code className="text-ink">.env.local</code> theo{" "}
        <code className="text-ink">.env.example</code> rồi chạy lại <code className="text-ink">npm run dev</code>.
      </p>
    );
  }

  const { products, error } = await getFeaturedProducts();
  if (error) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-[15px] text-muted">
        Không đọc được sản phẩm: {error}
      </p>
    );
  }
  if (products.length === 0) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-[15px] text-muted">
        Đã kết nối Supabase nhưng chưa có sản phẩm nổi bật. Chạy migration và seed theo README.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id} className="flex flex-col gap-3">
          <div className={`aspect-[4/5] rounded-card ${SWATCHES[index % SWATCHES.length]}`} />
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium">{product.name}</span>
            {product.material && <span className="text-[13px] text-muted">{product.material}</span>}
            <span className="text-[15px]">{formatVND(product.base_price)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 md:px-12 md:py-[22px]">
        <Logo />
        <Link
          href="/admin"
          className="inline-flex h-11 items-center rounded-full bg-ink px-[18px] text-[14px] font-medium text-cream hover:text-glow"
        >
          Quản trị
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-16 px-4 pb-16 pt-10 md:px-12 md:pt-[72px]">
        <section className="flex max-w-[640px] flex-col gap-6 md:gap-7">
          <p className="text-[12px] uppercase tracking-[0.14em] text-muted md:text-[13px]">
            Bộ sưu tập mùa Thu — Đông 2026
          </p>
          <h1 className="font-serif text-[44px] font-light leading-[1.04] tracking-[-0.02em] md:text-[76px] md:leading-[1.02]">
            Ánh sáng
            <br />
            làm nên <em className="font-normal italic text-terracotta">không gian.</em>
          </h1>
          <p className="max-w-[460px] text-[16px] leading-relaxed text-muted md:text-[17px]">
            Đèn, ghế, bàn và đồ decor được chọn lọc từ những xưởng thủ công — mỗi món một dáng, đủ đẹp để nhìn cả
            ngày.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex h-[52px] items-center rounded-full bg-ink px-[26px] text-[15px] font-medium text-cream">
              Khám phá bộ sưu tập
            </span>
            <span className="inline-flex h-[52px] items-center rounded-full border border-ink px-[26px] text-[15px] font-medium">
              Tư vấn qua Zalo
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="font-serif text-[28px] font-light tracking-[-0.01em] md:text-[36px]">
            Sản phẩm <em className="italic text-terracotta">nổi bật</em>
          </h2>
          <FeaturedProducts />
        </section>
      </main>

      <footer className="border-t border-line px-4 py-6 text-[13px] text-muted md:px-12">
        © 2026 Thế Giới Đèn 98. Showroom: An Khánh, Hà Nội · 9h–17h.
      </footer>
    </div>
  );
}
