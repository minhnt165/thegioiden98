-- Thế Giới Đèn 98 — schema gốc
-- Tiền lưu bằng số nguyên VND (bigint), không có phần lẻ.

-- ============================================================
-- Enum
-- ============================================================
create type public.product_status as enum ('draft', 'active', 'hidden');
create type public.product_badge as enum ('none', 'bestseller', 'new');
create type public.sales_channel as enum ('zalo', 'messenger', 'showroom');
create type public.payment_method as enum ('cod', 'bank_transfer', 'cash');
create type public.order_status as enum ('pending', 'packing', 'shipping', 'done', 'cancelled', 'returned');
create type public.quote_status as enum ('draft', 'sent', 'viewed', 'accepted', 'ordered', 'expired', 'rejected');
create type public.user_role as enum ('admin', 'staff');

-- ============================================================
-- Hàm dùng chung
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Danh mục
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index categories_parent_id_idx on public.categories (parent_id);

-- ============================================================
-- Sản phẩm
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories (id) on delete set null,
  description text,                       -- "Câu chuyện", HTML đơn giản từ trình soạn thảo
  material text,                          -- hiển thị: "Gỗ sồi · vải lanh"
  dimensions text,                        -- "Ø 28 × cao 38 cm"
  bulb text,                              -- "E27 · tối đa 40 W · không kèm bóng"
  extra_specs jsonb not null default '[]'::jsonb,   -- [{ "label": "Bảo hành", "value": "12 tháng" }]
  care_instructions text,                 -- "Giao hàng & bảo quản" riêng của món
  base_price bigint not null default 0 check (base_price >= 0),   -- giá "từ", chỉ để hiển thị
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= 0),
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  badge public.product_badge not null default 'none',
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),  -- null: dùng ngưỡng trong settings
  -- Thẻ lọc ở cửa hàng
  material_tags text[] not null default '{}' check (material_tags <@ array['go', 'gom', 'kim-loai', 'thuy-tinh', 'vai-may-tre']),
  color_tags text[] not null default '{}' check (color_tags <@ array['den', 'dong', 'go', 'kem', 'xanh-reu']),
  spaces text[] not null default '{}' check (spaces <@ array['phong-khach', 'phong-ngu', 'goc-lam-viec']),
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_material_tags_idx on public.products using gin (material_tags);
create index products_color_tags_idx on public.products using gin (color_tags);
create index products_spaces_idx on public.products using gin (spaces);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Nhóm phân loại, ví dụ "Màu chao", "Kích cỡ"
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (product_id, name)
);
create index product_options_product_id_idx on public.product_options (product_id);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,
  value text not null,
  hex text check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  unique (option_id, value)
);
create index product_option_values_option_id_idx on public.product_option_values (option_id);

-- Mỗi dòng của bảng phân loại. option_values: { "Màu chao": "Kem lanh", "Kích cỡ": "Nhỏ" }
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  price bigint not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  option_values jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,             -- đường dẫn trong bucket "products"
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on public.product_images (product_id);
create unique index product_images_one_cover_idx on public.product_images (product_id) where is_cover;

-- ============================================================
-- Khách hàng
-- ============================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  channel public.sales_channel not null default 'zalo',
  note text,
  created_at timestamptz not null default now()
);
create index customers_phone_idx on public.customers (phone);

-- ============================================================
-- Đơn hàng — mã dạng "#1047"
-- ============================================================
create sequence public.order_code_seq start with 1040;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('#' || nextval('public.order_code_seq')),
  customer_id uuid references public.customers (id) on delete restrict,
  channel public.sales_channel not null,
  payment public.payment_method not null default 'cod',
  status public.order_status not null default 'pending',
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  total bigint not null default 0 check (total >= 0),
  note text,                              -- ghi chú nội bộ
  source_quote_id uuid,                   -- FK thêm sau khi có bảng quotes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_customer_id_idx on public.orders (customer_id);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  name_snapshot text not null,
  variant_snapshot text,                  -- "Kem lanh · Nhỏ"
  unit_price bigint not null check (unit_price >= 0),
  qty integer not null check (qty > 0)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

-- ============================================================
-- Báo giá — mã dạng "BG-0012", link công khai /bg/<public_token>
-- ============================================================
create sequence public.quote_code_seq start with 9;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('BG-' || lpad(nextval('public.quote_code_seq')::text, 4, '0')),
  customer_id uuid references public.customers (id) on delete restrict,
  status public.quote_status not null default 'draft',
  message text,
  terms text,
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  subtotal bigint not null default 0 check (subtotal >= 0),
  total bigint not null default 0 check (total >= 0),
  valid_until date,
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  view_count integer not null default 0,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  order_id uuid references public.orders (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_status_idx on public.quotes (status);
create index quotes_customer_id_idx on public.quotes (customer_id);
create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.orders
  add constraint orders_source_quote_id_fkey
  foreign key (source_quote_id) references public.quotes (id) on delete set null;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  name_snapshot text not null,
  variant_snapshot text,
  unit_price bigint not null check (unit_price >= 0),
  qty integer not null check (qty > 0),
  sort_order integer not null default 0
);
create index quote_items_quote_id_idx on public.quote_items (quote_id);

-- ============================================================
-- Cài đặt — is_public = true thì cửa hàng đọc được (SĐT Zalo, link MXH…)
-- ============================================================
create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- Hồ sơ người dùng quản trị
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'staff',
  full_name text,
  created_at timestamptz not null default now()
);

-- Tạo profile khi có user mới trong Supabase Auth. Mặc định là staff (chưa vào được /admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Email đăng ký nhận tin ở footer (ghi qua Server Action bằng service role)
-- ============================================================
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_idx on public.newsletter_subscribers (lower(email));
