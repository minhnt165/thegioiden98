-- Row Level Security
-- Khách (anon) chỉ đọc danh mục, sản phẩm đang bán và cài đặt công khai.
-- Báo giá công khai /bg/<token> đọc qua Route Handler dùng service role, không qua policy.
-- Admin (profiles.role = 'admin') toàn quyền.

-- ============================================================
-- Hàm kiểm tra quyền
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Sản phẩm đang bán (dùng trong policy các bảng con)
create or replace function public.is_product_active(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products
    where id = p_product_id and status = 'active'
  );
$$;

revoke execute on function public.is_product_active(uuid) from public;
grant execute on function public.is_product_active(uuid) to anon, authenticated;

-- ============================================================
-- Bật RLS cho mọi bảng
-- ============================================================
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ============================================================
-- Quyền bảng (RLS quyết định dòng nào được thấy)
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on
  public.categories,
  public.products,
  public.product_options,
  public.product_option_values,
  public.product_variants,
  public.product_images,
  public.settings
to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================
-- Đọc công khai
-- ============================================================
create policy "Ai cũng xem được danh mục"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Ai cũng xem được sản phẩm đang bán"
  on public.products for select
  to anon, authenticated
  using (status = 'active' or (select public.is_admin()));

create policy "Xem nhóm phân loại của sản phẩm đang bán"
  on public.product_options for select
  to anon, authenticated
  using (public.is_product_active(product_id) or (select public.is_admin()));

create policy "Xem giá trị phân loại của sản phẩm đang bán"
  on public.product_option_values for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.product_options o
      where o.id = option_id and public.is_product_active(o.product_id)
    )
    or (select public.is_admin())
  );

create policy "Xem phân loại đang bật của sản phẩm đang bán"
  on public.product_variants for select
  to anon, authenticated
  using ((is_active and public.is_product_active(product_id)) or (select public.is_admin()));

create policy "Xem ảnh của sản phẩm đang bán"
  on public.product_images for select
  to anon, authenticated
  using (public.is_product_active(product_id) or (select public.is_admin()));

create policy "Xem cài đặt công khai"
  on public.settings for select
  to anon, authenticated
  using (is_public or (select public.is_admin()));

-- ============================================================
-- Admin toàn quyền ghi
-- ============================================================
create policy "Admin quản lý danh mục" on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý sản phẩm" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý nhóm phân loại" on public.product_options
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý giá trị phân loại" on public.product_option_values
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý phân loại" on public.product_variants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý ảnh sản phẩm" on public.product_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý khách hàng" on public.customers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý đơn hàng" on public.orders
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý món trong đơn" on public.order_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý báo giá" on public.quotes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý món trong báo giá" on public.quote_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin quản lý cài đặt" on public.settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin xem email đăng ký" on public.newsletter_subscribers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ============================================================
-- Hồ sơ: tự xem hồ sơ của mình; chỉ admin được đổi role
-- ============================================================
create policy "Xem hồ sơ của mình"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Admin quản lý hồ sơ" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
