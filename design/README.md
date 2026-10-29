# Design mockup – Thế Giới Đèn 98

Mỗi file HTML là một màn hình đã thiết kế. Đọc phần markup bên trong thẻ <x-dc> để lấy
bố cục, màu, cỡ chữ, khoảng cách (toàn bộ style viết inline). Các file không chạy
độc lập (thiếu ./support.js) – chỉ dùng để tham khảo khi code lại bằng Next.js/Tailwind.

Cửa hàng
- Main.html            Trang chủ (desktop 1440)
- Products.html        Danh sách sản phẩm
- ProductDetail.html   Chi tiết sản phẩm (có chọn màu)
- MobileHome.html      Trang chủ bản điện thoại (390)
- QuoteCustomer.html   Trang khách xem báo giá /bg/[code] (390)
- Logo.html            Logo và biến thể, bảng màu thương hiệu

Admin
- AdminDashboard.html    Tổng quan
- AdminOrders.html       Đơn hàng
- AdminProducts.html     Danh sách sản phẩm
- AdminProductEdit.html  Thêm / sửa sản phẩm
- AdminQuotes.html       Danh sách báo giá
- AdminQuoteNew.html     Lập báo giá

Token màu: nền #F3EFE7 · chữ #1B1916 · phụ #5E5952 · viền #DCD5C7 · nhấn #B8612A · ánh đèn #F6E8C9
Font: Fraunces (tiêu đề) + Be Vietnam Pro (nội dung)
