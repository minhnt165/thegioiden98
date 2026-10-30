# Phân quyền nhân viên — thiết kế

Ngày: 2026-10-30 · Phần 2/7. Làm **sau** phần 1 (nhập kho — `2026-10-30-nhap-kho-design.md`), vì bảng quyền có dòng
cho phiếu nhập / điều chỉnh tồn.

## Vì sao

Enum `user_role` đã có `staff` và user mới mặc định là `staff`, nhưng cả hệ thống chỉ cho `admin` vào:
`public.is_admin()` ở mọi policy / hàm `admin_*`, `requireAdmin()` ([src/lib/admin/auth.ts](../../../src/lib/admin/auth.ts))
ở layout admin và mọi Server Action. Muốn có người phụ bán hàng thì hoặc cho họ quyền admin (sửa được giá, cài đặt, xem
doanh thu), hoặc không cho vào. Tạo tài khoản cũng phải vào dashboard Supabase.

Mục tiêu: nhân viên làm được việc bán hàng hằng ngày, không đụng được giá / cấu hình / số liệu kinh doanh; chủ shop tự
quản lý tài khoản trong `/admin`.

## Vai trò và quyền

| Việc | Chủ shop (`admin`) | Nhân viên (`staff`) |
|---|---|---|
| Đơn hàng: xem, tạo, sửa, đổi trạng thái (kể cả hủy / trả), in phiếu giao | ✓ | ✓ |
| Báo giá: xem, lập, sửa, gửi, chuyển thành đơn, in | ✓ | ✓ |
| Khách hàng: xem, thêm, sửa | ✓ | ✓ |
| Sản phẩm: xem danh sách, xem chi tiết + tồn + lịch sử kho | ✓ | ✓ (chỉ xem) |
| Phiếu nhập kho: tạo, xem | ✓ | ✓ |
| Điều chỉnh tồn | ✓ | ✗ |
| Thêm / sửa sản phẩm, giá, ảnh, biến thể; danh mục | ✓ | ✗ |
| Tổng quan: các ô việc cần làm (chờ xác nhận, hết hàng…) | ✓ | ✓ |
| Tổng quan: doanh thu, biểu đồ, số liệu bán; xuất Excel đơn hàng | ✓ | ✗ |
| Cài đặt; quản lý tài khoản | ✓ | ✗ |

## Mục tiêu

1. **Kiểm quyền hai tầng theo bảng trên**: database (RLS + đầu các hàm `admin_*`) và server (layout / page / Server
   Action / route). Tầng database là chốt chặn thật; tầng server để báo lỗi rõ ràng.
2. **Giao diện theo vai trò**:
   - Menu ẩn mục không có quyền (Danh mục, Cài đặt, Tài khoản với nhân viên).
   - Gõ thẳng URL trang không có quyền → trang "Bạn không có quyền xem trang này" (trong khung admin, có link về Tổng quan).
   - Nút / hành động không có quyền thì ẩn (nút "Thêm sản phẩm", "Xuất Excel", "Điều chỉnh" tồn…).
   - Trang sản phẩm với nhân viên: **chế độ chỉ xem** — cùng bố cục, các ô không sửa được, không có nút Lưu / Xóa.
   - Tổng quan với nhân viên: chỉ phần việc cần làm, không có doanh thu / biểu đồ / số liệu bán.
3. **Màn "Tài khoản"** (`/admin/tai-khoan` gợi ý, chỉ chủ shop, mục cuối menu trước Cài đặt):
   - Danh sách: họ tên, email, vai trò, trạng thái (đang hoạt động / đã khóa), lần đăng nhập gần nhất.
   - **Thêm tài khoản**: họ tên, email, mật khẩu tạm, vai trò → tạo user đã xác nhận email (service role, server only).
   - **Sửa**: họ tên, vai trò; **đặt lại mật khẩu** (chủ shop nhập mật khẩu mới).
   - **Khóa / mở khóa**: tài khoản bị khóa không đăng nhập được, phiên đang mở cũng bị chặn ở request kế tiếp. Không xóa user,
     để lịch sử đơn / kho vẫn hiện tên người làm.
   - Không cho tự khóa, tự hạ vai trò chính mình; không cho thao tác làm shop còn 0 admin đang hoạt động.
4. **Tên người làm**: các chỗ đang lưu `created_by` (lịch sử đơn, sổ kho) hiển thị họ tên từ `profiles.full_name`
   (thiếu thì email).

## Không làm (lần này)

- Quyền tùy chỉnh theo từng người (tick từng quyền) — chỉ hai vai trò cố định.
- Nhật ký đăng nhập / nhật ký thao tác riêng (ngoài `created_by` sẵn có).
- Quên mật khẩu qua email, mời qua email, đăng nhập Google.
- Nhân viên tự đổi mật khẩu — có thể làm sau nếu cần.

## Không được xảy ra

- Nhân viên đổi được giá / sản phẩm / cài đặt / vai trò, hoặc lấy được số liệu tổng hợp (doanh thu, KPI, biểu đồ,
  tỉ lệ chốt báo giá, file Excel) — kể cả gọi thẳng Supabase bằng anon key + phiên của mình (tức là phải chặn ở RLS /
  hàm SQL, không chỉ ẩn nút).

**Ranh giới "số liệu kinh doanh"** (đã chốt với chủ shop): chỉ ẩn số liệu **tổng hợp** — doanh thu / KPI / biểu đồ / tỉ lệ
chốt ở Tổng quan và xuất Excel; các con số này chuyển sang hàm / RPC chỉ admin gọi được (hiện `dashboard.ts` cộng dồn
từ bảng `orders` ở Node). Nhân viên **vẫn thấy**: từng đơn kèm tổng tiền, "Tổng chi tiêu" / "Trung bình / đơn" của khách
(`customer_list`), cột "Đã bán" ở danh sách sản phẩm (`product_sales`). Chấp nhận việc nhân viên về lý thuyết có thể tự
cộng tổng tiền các đơn — không giới hạn đơn họ được xem.
- Shop mất hết tài khoản admin.
- Tài khoản đã khóa vẫn thao tác được.
- Khách (anon) thấy nhiều hơn hiện nay.

## Ràng buộc

- Không sửa migration cũ; migration mới `create or replace` các hàm / `drop policy … create policy` các policy cần đổi.
- Dữ liệu doanh thu hiện đọc ở `src/lib/admin/dashboard.ts` — chặn ở tầng dữ liệu (nhân viên không đọc được bảng / view
  tổng hợp), không chỉ ẩn khối.
- Service role key chỉ dùng phía server (`src/lib/supabase/admin.ts`), như hiện nay.
- `staff` mặc định cho user mới giữ nguyên. Tài khoản admin hiện có không bị ảnh hưởng.
- Chạy `npm run db:types` sau migration.

## Quyết định của mình (Claude) — bạn kiểm tra

- Nhân viên **được hủy đơn và đánh dấu trả hàng** (đều cộng kho, có ghi sổ kho + tên người làm).
- Nhân viên **được đặt giá / giảm giá trên đơn và báo giá** như chủ shop (đó là việc bán hàng); chỉ không sửa giá niêm yết
  của sản phẩm.
- Nhân viên **không xem danh sách đăng ký nhận tin** và không xuất Excel nào.
- "Khóa" = cờ trên `profiles` + chặn đăng nhập ở Supabase Auth (ban), kiểm cả hai.
- **Chặn tự đăng ký**: vì `staff` giờ có quyền thật, ai cầm anon key gọi `auth.signUp` cũng sẽ thành nhân viên. Nên:
  profile mới mặc định **đang khóa**; chỉ tài khoản tạo từ màn Tài khoản mới được bật. Migration khóa luôn mọi profile
  `staff` đang có (admin giữ nguyên). Đồng thời đặt `enable_signup = false` trong `supabase/config.toml` và ghi vào README
  bước tắt sign up trên dashboard (README đã có bước này cho project hosted).
- Nhân viên **không xóa khách hàng** (chỉ xem / thêm / sửa như bảng quyền).
- Nhân viên đọc được các cài đặt cần cho việc bán: điều khoản báo giá, số ngày hiệu lực báo giá, ngưỡng sắp hết hàng; và
  đọc được họ tên người dùng khác để hiện cột "người làm".
- Tổng quan của nhân viên giữ "Đơn gần đây" và danh sách sắp hết hàng, bỏ doanh thu / KPI / biểu đồ / tỉ lệ chốt báo giá.

## Để người làm tự quyết

- Tên hàm SQL (gợi ý: giữ `is_admin()`, thêm `is_staff()` = admin hoặc staff đang hoạt động) và cách tổ chức lại policy.
- Cách làm chế độ chỉ xem cho `ProductForm` (prop `readOnly` hay `fieldset disabled`).
- Bố cục màn Tài khoản (theo các danh sách admin sẵn có, không có mockup).
- Helper phía server (ví dụ `requireRole("admin" | "staff")` thay cho / bên cạnh `requireAdmin()`).

## Kiểm tra

- E2E: tạo tài khoản nhân viên từ màn Tài khoản → đăng nhập bằng nhân viên → tạo đơn, lập báo giá, tạo phiếu nhập được;
  không thấy menu Danh mục / Cài đặt / Tài khoản; mở URL `/admin/cai-dat` thấy trang không có quyền; trang sản phẩm chỉ xem;
  Tổng quan không có doanh thu. Khóa tài khoản → không đăng nhập được.
- Kiểm tầng DB: với phiên nhân viên, gọi trực tiếp `admin_save_product`, update `settings`, đọc dữ liệu doanh thu → bị từ chối.
- `npm run typecheck`, `npm run lint`.
