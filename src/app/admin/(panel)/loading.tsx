import { ContentSkeleton } from "@/components/admin/ContentSkeleton";

// Chuyển trang trong admin chỉ render lại phần dưới layout (panel), nên <Suspense> trong layout
// không bắt được lúc điều hướng. Boundary này nằm dưới layout: hiện khung chờ ngay khi bấm link
// trong lúc trang mới đọc dữ liệu theo phiên đăng nhập.
export default function AdminPanelLoading() {
  return <ContentSkeleton />;
}
