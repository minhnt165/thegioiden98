import { MobileContactBar } from "@/components/shop/MobileContactBar";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { GENERAL_MESSAGE, messengerLink, zaloLink } from "@/lib/shop/contact";
import { getShopSettings } from "@/lib/shop/settings";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const settings = await getShopSettings();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader settings={settings} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter settings={settings} />
      <MobileContactBar
        zaloHref={zaloLink(settings.zaloPhone)}
        messengerHref={messengerLink(settings.messengerUrl, GENERAL_MESSAGE)}
      />
    </div>
  );
}
