import type { Metadata } from "next";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Thêm khách" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/admin/khach-hang", label: "Khách hàng" }]}
        title="Thêm khách"
        subtitle="Thường không cần: khách được lưu tự động khi tạo đơn hoặc lập báo giá."
      />
      <Card className="max-w-xl">
        <CustomerForm initial={{ id: null, name: "", phone: "", address: "", channel: "zalo", note: "" }} />
      </Card>
    </>
  );
}
