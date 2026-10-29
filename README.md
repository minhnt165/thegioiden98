# Thế Giới Đèn 98

Website bán đèn & nội thất decor: cửa hàng công khai + trang quản trị `/admin`.
Không có giỏ hàng — khách đặt qua Zalo/Messenger, shop tạo đơn hoặc gửi báo giá qua link `/bg/<token>`.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage) · zod.
Mockup tham chiếu nằm trong [`design/`](design/README.md).

## Chạy ở máy

```bash
npm install
cp .env.example .env.local   # điền URL + key Supabase
npm run dev                  # http://localhost:4000
```

> Mạng công ty có kiểm tra SSL: đặt `NODE_OPTIONS=--use-system-ca` (PowerShell: `$env:NODE_OPTIONS="--use-system-ca"`,
> hoặc lưu hẳn bằng `setx NODE_OPTIONS --use-system-ca`) để npm và Supabase CLI dùng chứng chỉ của Windows.
> Dự án đã có `.npmrc` trỏ về registry npm công khai.

## Tạo Supabase

1. **Tạo project** tại <https://supabase.com/dashboard> → New project. Region: *Southeast Asia (Singapore)*. Lưu lại Database Password.
2. **Lấy key** (*Project Settings → API Keys*) và điền `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng ở server)
3. **Cấu hình Auth:**
   - *Authentication → Sign In / Providers → Email*: tắt **Allow new users to sign up**.
   - *Authentication → URL Configuration*: Site URL `http://localhost:4000`, Redirect URLs thêm `http://localhost:4000/**` (khi deploy thêm domain thật).
4. **Tạo tài khoản admin:** *Authentication → Users → Add user → Create new user*, tick **Auto Confirm User**.
5. **Chạy migration + seed** — một trong hai cách:
   - CLI:
     ```bash
     npx supabase login
     npm run db:link -- --project-ref <ref>   # <ref> là phần xxxx trong https://xxxx.supabase.co
     npm run db:push                          # migration + seed
     ```
   - SQL Editor (khi mạng chặn cổng Postgres): dán và chạy lần lượt các file trong `supabase/migrations/` theo thứ tự tên, sau đó `supabase/seed.sql`.
6. **Nâng quyền admin:** sửa email trong [`supabase/snippets/grant-admin.sql`](supabase/snippets/grant-admin.sql) rồi chạy trong SQL Editor.
7. **Sinh lại kiểu dữ liệu:** `npm run db:types` (cần đã `db:link`).

## Scripts

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Dev server cổng 4000 |
| `npm run build` / `start` | Build và chạy production |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run db:link` · `db:push` · `db:types` | Supabase CLI: link project, đẩy migration + seed, sinh `src/types/database.ts` |

## Cấu trúc

```
supabase/
  migrations/      schema, RLS, bucket ảnh "products"
  seed.sql         dữ liệu mẫu theo mockup
  snippets/        SQL chạy tay (nâng quyền admin)
src/
  app/             routes (cửa hàng, /admin, /bg/[token])
  components/      brand/, ui/, shop/, admin/
  lib/supabase/    client.ts (trình duyệt) · server.ts (theo phiên) · public.ts (ẩn danh, dùng trong "use cache")
                   admin.ts (service role, chỉ server) · proxy.ts (làm mới session, chặn /admin)
  lib/format.ts    tiền 1.890.000₫, ngày 29/10/2026
  proxy.ts         Next 16 proxy (trước đây là middleware)
  types/database.ts
```

## Quy ước dữ liệu

- Tiền lưu số nguyên VND (`bigint`). Giá & tồn theo **variant**; `products.base_price` chỉ là giá "từ".
- Không xóa cứng sản phẩm/đơn/báo giá — dùng `status`. Xóa ảnh phải xóa cả file trong Storage.
- Kho trừ ngay khi tạo đơn, cộng lại khi hủy / khách trả hàng (`orders.stock_deducted`). Chỉ sửa được đơn đang chờ xác nhận.
- SĐT Zalo, link Messenger/Instagram đọc từ bảng `settings` (`is_public = true`), sửa ở `/admin/cai-dat`.
- Mã đơn `#1047`, mã báo giá `BG-0012` sinh bằng sequence. Link báo giá công khai dùng `public_token` ngẫu nhiên.
- Báo giá không giữ kho. Khách bấm "Đồng ý" trên link → tự tạo đơn chờ xác nhận (trừ kho); thiếu hàng thì báo giá dừng ở
  "Khách đồng ý" để shop sửa rồi tạo đơn tay. Báo giá đã gửi mà quá ngày hiệu lực được tính là hết hạn.
- Quyền: khách (anon) chỉ đọc danh mục, sản phẩm `active`, cài đặt công khai. User mới mặc định `staff`; chỉ `admin` vào được `/admin`.
