import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import { artKindFor, tintFor } from "@/components/shop/ProductArt";
import { Breadcrumbs } from "@/components/shop/ProductListing";
import { ProductView } from "@/components/shop/ProductView";
import { badgeLabel, getCatalog, getProduct, productImageUrl, relatedProducts } from "@/lib/shop/catalog";
import { plainText, splitStory } from "@/lib/shop/richtext";
import { getShopSettings } from "@/lib/shop/settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000";

export async function generateMetadata({ params }: PageProps<"/san-pham/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return {
    title: product.name,
    description: product.seoDescription ?? plainText(product.description, 160),
  };
}

function ProductSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải sản phẩm" className="flex flex-col gap-8 px-5 pt-5 md:px-12 lg:flex-row lg:gap-14">
      <div className="aspect-square animate-pulse rounded-[28px] bg-line/50 lg:flex-[999_1_520px]" />
      <div className="flex flex-col gap-4 lg:flex-[1_1_380px]">
        <div className="h-4 w-40 animate-pulse rounded-full bg-line/60" />
        <div className="h-14 w-3/4 animate-pulse rounded-full bg-line/60" />
        <div className="h-20 animate-pulse rounded-card bg-line/40" />
        <div className="h-14 animate-pulse rounded-full bg-line/50" />
        <div className="h-14 animate-pulse rounded-full bg-line/50" />
      </div>
    </div>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, catalog, settings] = await Promise.all([getProduct(slug), getCatalog(), getShopSettings()]);
  if (!product) notFound();

  const group = product.parentCategory ?? product.category;
  const story = splitStory(product.description);
  const related = relatedProducts(catalog, product);
  const specs = [
    { label: "Kích thước", value: product.dimensions },
    { label: "Chất liệu", value: product.material },
    { label: "Bóng đèn", value: product.bulb },
    ...product.extraSpecs,
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));
  const careNotes = [
    ...settings.shippingNotes.slice(0, 2),
    ...(product.careInstructions ? [product.careInstructions] : []),
    ...settings.shippingNotes.slice(2),
  ];

  return (
    <>
      <div className="px-5 pt-5 md:px-12 md:pt-7">
        <Breadcrumbs
          items={[
            { href: "/", label: "Trang chủ" },
            ...(group ? [{ href: `/danh-muc/${group.slug}`, label: group.name }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <ProductView
        product={{
          name: product.name,
          eyebrow: product.category?.name ?? "Sản phẩm",
          lead: product.seoDescription ?? (plainText(story.body, 220) || null),
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          badge: badgeLabel(product.badge),
          url: `${SITE_URL}/san-pham/${product.slug}`,
        }}
        options={product.options}
        variants={product.variants}
        images={product.images.map((img) => ({ url: productImageUrl(img.path) }))}
        art={{ kind: artKindFor(product.categorySlug, product.name), tint: tintFor(product.slug) }}
        contact={{
          zaloPhone: settings.zaloPhone,
          messengerUrl: settings.messengerUrl,
          deliveryTime: settings.deliveryTime,
          preorderTime: settings.preorderTime,
        }}
      >
        {specs.length > 0 && (
          <dl className="flex flex-col border-t border-line">
            {specs.map((s) => (
              <div key={s.label} className="flex justify-between gap-4 border-b border-line py-3.5 text-[14px]">
                <dt className="shrink-0 text-muted">{s.label}</dt>
                <dd className="text-right">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </ProductView>

      {(story.quote || story.body || careNotes.length > 0) && (
        <section className="mx-5 grid gap-10 rounded-[22px] border border-line bg-white px-6 py-8 md:mx-12 md:rounded-4xl md:px-16 md:py-14 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            <span className="text-[12px] uppercase tracking-[0.14em] text-muted">Câu chuyện</span>
            {story.quote && (
              <p className="font-serif text-[24px] font-light leading-[1.2] tracking-[-0.01em] md:text-[32px]">{story.quote}</p>
            )}
            {story.body && (
              <div
                className="flex flex-col gap-3 text-[15px] leading-[1.7] text-muted [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:text-ink [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: story.body }}
              />
            )}
          </div>
          {careNotes.length > 0 && (
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
              <span className="text-[12px] uppercase tracking-[0.14em] text-muted">Giao hàng &amp; bảo quản</span>
              <ul className="list-disc pl-4.5 text-[15px] leading-[1.8] text-muted">
                {careNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="flex flex-col gap-6 px-5 pt-14 md:gap-7 md:px-12 md:pt-18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-[30px] font-light tracking-[-0.02em] md:text-[40px]">Hợp với món này</h2>
            {group && (
              <Link href={`/danh-muc/${group.slug}`} className="text-[14px] font-medium underline underline-offset-4 md:text-[15px]">
                Xem thêm {group.name.toLowerCase()}
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-x-3.5 gap-y-8 md:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/san-pham/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
