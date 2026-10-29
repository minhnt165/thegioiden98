import Link from "next/link";

// Trang admin gọi notFound() (đơn, báo giá, khách, sản phẩm không tồn tại): giữ nguyên sidebar quản trị.
export default function AdminNotFound() {
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-card border border-line bg-white p-6">
      <h1 className="font-serif text-[24px]">Không tìm thấy dữ liệu</h1>
      <p className="text-[14px] leading-relaxed text-muted">
        Bản ghi này không tồn tại hoặc đã bị xóa. Kiểm tra lại đường dẫn, hoặc quay về trang tổng quan.
      </p>
      <Link
        href="/admin"
        className="inline-flex h-10 w-fit items-center rounded-input border border-line px-4 text-[14px] hover:border-ink"
      >
        Về tổng quan
      </Link>
    </div>
  );
}
