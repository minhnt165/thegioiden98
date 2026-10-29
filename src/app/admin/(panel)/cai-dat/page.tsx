import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { getAllSettings } from "@/lib/admin/settings";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const values = await getAllSettings();
  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thông tin hiện trên cửa hàng, kênh liên hệ, mặc định cho báo giá và kho." />
      <SettingsForm values={values} />
    </>
  );
}
