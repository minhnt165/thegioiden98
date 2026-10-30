# Nhập kho & lịch sử tồn — thiết kế

Ngày: 2026-10-30 · Phần 1/7 của đợt "vận hành + tăng bán hàng".

## Vì sao

Hiện tồn của mỗi biến thể (`product_variants.stock`) chỉ thay đổi theo hai cách:

- Đơn hàng tự trừ / cộng (`admin_save_order`, `admin_set_order_status`, `quote_create_order`).
- Admin gõ đè số ở ô "Tồn" trong form sửa sản phẩm (`VariantEditor` → `admin_save_product` ghi thẳng `stock`).

Không có dấu vết: không biết ai đổi, lúc nào, vì sao. Hàng về, hàng vỡ, kiểm kê lệch đều phải gõ đè số. Ngoài ra còn
một lỗi tiềm ẩn: mở form sản phẩm, trong lúc đó có đơn trừ kho, bấm Lưu thì số tồn cũ trong form ghi đè lên — mất phần đã trừ.

Mục tiêu: mọi thay đổi tồn đều có lý do và được ghi lại; nhập hàng / điều chỉnh có màn hình riêng thay cho gõ đè.

## Mục tiêu

1. **Sổ kho**: mỗi lần tồn của một biến thể đổi → một dòng lịch sử: biến thể, số thay đổi (+/−), tồn sau thay đổi,
   loại, lý do / ghi chú, liên kết (đơn hoặc phiếu nhập), người làm, thời gian.
   Loại: **Tồn đầu** · **Nhập hàng** · **Bán** (trừ khi tạo / sửa đơn) · **Hủy / trả** (cộng lại khi hủy đơn, khách trả,
   hoặc trả lại khi sửa đơn) · **Điều chỉnh**.
2. **Phiếu nhập kho**: màn hình mới, chọn nhiều biến thể, mỗi dòng một số lượng (> 0), ghi chú tự do (nhà cung cấp,
   số hóa đơn…). Lưu một lần → cộng kho tất cả dòng + ghi sổ. Mã `PN-0001` sinh bằng sequence (giống `BG-0012`).
   Xem lại danh sách phiếu và chi tiết từng phiếu.
3. **Điều chỉnh tồn**: ở trang sửa sản phẩm, mỗi biến thể có nút "Điều chỉnh". Hộp thoại: số thay đổi (+/−, khác 0),
   lý do bắt buộc chọn: *Vỡ / hỏng* · *Kiểm kê lệch* · *Khác* (chọn Khác thì bắt buộc ghi chú). Hiện trước "tồn sau
   điều chỉnh". Không cho tồn xuống dưới 0.
4. **Khóa ô "Tồn" trong form sản phẩm**: biến thể đã có → chỉ hiển thị tồn hiện tại (không sửa), kèm nút Điều chỉnh.
   Biến thể mới thêm → vẫn nhập tồn ban đầu, ghi sổ loại *Tồn đầu*. `admin_save_product` không được ghi `stock` của
   biến thể đã có nữa (sửa luôn lỗi ghi đè ở trên). Ô "đặt tồn hàng loạt" trong `VariantEditor` chỉ áp cho biến thể mới.
5. **Xem lịch sử**:
   - Trang sửa sản phẩm: khối "Lịch sử kho" — các dòng gần nhất của mọi biến thể sản phẩm đó, có link "Xem tất cả".
   - Màn hình **Kho** (mục mới trong menu admin, giữa "Danh mục" và "Khách hàng"), hai tab:
     *Phiếu nhập* (danh sách + nút "Tạo phiếu nhập") và *Lịch sử* (lọc theo loại, tìm sản phẩm / SKU không dấu,
     khoảng ngày; phân trang như các danh sách admin khác).
   - Dòng lịch sử loại Bán / Hủy / trả link tới đơn; loại Nhập hàng link tới phiếu.

6. **Xóa biến thể còn tồn** (đã chốt với chủ shop): lưu form sản phẩm mà sẽ xóa biến thể có tồn > 0 — kể cả khi xóa do
   đổi nhóm tùy chọn (`rebuildVariants` tạo lại toàn bộ biến thể) — thì form hiện cảnh báo liệt kê từng biến thể và số
   tồn sẽ trừ ("Đèn bàn Gốm – Trắng còn 5, lưu sẽ trừ khỏi kho"), phải xác nhận mới lưu. Sổ kho ghi mỗi biến thể một dòng
   *Điều chỉnh* −N, ghi chú "Xóa biến thể". Biến thể mới tạo ra nhập tồn ban đầu như mục 4. Phía SQL cũng phải ghi dòng
   này (không dựa vào form), để không có đường nào xóa biến thể mà mất tồn không dấu vết.

## Không làm (lần này)

- Giá nhập, giá vốn, lãi lỗ.
- Nhiều kho / chi nhánh, chuyển kho.
- Danh sách nhà cung cấp riêng (chỉ ghi chú tự do trên phiếu).
- Xuất Excel sổ kho.
- Sửa / xóa / hủy phiếu nhập đã lưu. Nhập sai thì làm phiếu Điều chỉnh để bù (ghi chú nhắc mã phiếu).

## Không được xảy ra

- Tồn thay đổi mà sổ kho không có dòng tương ứng — kể cả các đường đổi tồn sẵn có (tạo / sửa / hủy / trả đơn,
  báo giá thành đơn, khách bấm Đồng ý trên link báo giá).
- Lưu form sản phẩm làm đổi tồn của biến thể đã có.
- Tồn âm.

## Ràng buộc

- Theo quy ước sẵn có trong README: tiền / số lượng là số nguyên, không xóa cứng, thao tác ghi đi qua hàm SQL
  (`admin_*`, `security invoker`, kiểm `public.is_admin()`), RLS chỉ cho admin.
- Migration mới đặt tên tiếp theo dãy hiện tại (`20261029000009_…` hoặc theo ngày mới), không sửa migration cũ —
  hàm cũ thay bằng `create or replace` trong migration mới.
- Quyền: lần này chỉ `admin`. Phần 2 (phân quyền nhân viên) sẽ mở cho `staff` sau, nên đừng gắn cứng thêm chỗ nào ngoài
  `is_admin()`.
- UI theo các màn admin sẵn có (`ui.tsx`, `ContentSkeleton`, bộ lọc + bảng như `OrderFilters` / `OrderTable`),
  không có mockup riêng cho màn Kho.
- Sau migration: `npm run db:types`.

## Quyết định của mình (Claude) — bạn kiểm tra

- **Dữ liệu cũ**: migration ghi một dòng *Tồn đầu* cho mỗi biến thể hiện có, bằng tồn hiện tại, để sổ khớp với số tồn từ
  ngày bắt đầu.
- **Xóa biến thể**: dòng sổ kho giữ lại, `variant_id` thành null (giống `order_items`), nên dòng sổ lưu kèm SKU và tên
  biến thể tại thời điểm ghi để vẫn đọc được.
- **Sửa đơn chờ xác nhận**: được phép ra hai nhóm dòng (trả lại kho món cũ, trừ kho món mới), ghi chú "Sửa đơn #1047".
  Không cần gộp thành số chênh.
- **Không cho sửa / hủy phiếu nhập** (xem phần Không làm).
- Điều chỉnh nhập **số thay đổi**, không nhập "số đếm thực tế"; hộp thoại hiện tồn hiện tại và tồn sau điều chỉnh.
- Dòng *Tồn đầu* lúc migration chỉ ghi cho biến thể có tồn > 0.
- Dòng sổ lưu cả `product_id`, để khối "Lịch sử kho" ở trang sản phẩm vẫn hiện được dòng của biến thể đã xóa.
- Khách bấm "Đồng ý" trên link báo giá (đường service role) → người làm để trống, hiển thị "Khách (link báo giá)".
- Phiếu nhập được chọn cả biến thể đang tắt và sản phẩm đang ẩn / lưu trữ (hàng có thể về trước khi mở bán).

## Để người làm tự quyết

- Cách bảo đảm "không lọt dòng nào": trigger trên `product_variants.stock` (truyền loại / liên kết qua
  `set_config` trong giao dịch) hay ghi tường minh trong từng hàm — chọn cách nào chắc chắn và dễ đọc hơn.
- Tên bảng, cột, route (gợi ý: `stock_movements`, `stock_receipts`, `stock_receipt_items`; route `/admin/kho`,
  `/admin/kho/nhap/moi`, `/admin/kho/nhap/[id]`).
- Cách chọn biến thể trong phiếu nhập (tái dùng ô tìm sản phẩm của `OrderForm` / `QuoteForm` nếu hợp).
- Số dòng hiện trong khối "Lịch sử kho" ở trang sản phẩm.

## Kiểm tra

- E2E Playwright (theo mẫu `e2e/`): tạo phiếu nhập → tồn tăng + có dòng sổ; điều chỉnh trừ → tồn giảm, không cho âm;
  tạo đơn / hủy đơn → có dòng Bán / Hủy-trả; lưu form sản phẩm không đổi tồn biến thể cũ. Dọn dữ liệu test như các spec
  hiện có.
- `npm run typecheck`, `npm run lint`.
