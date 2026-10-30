-- Sổ kho: mọi thay đổi tồn của phân loại đều có một dòng trong stock_movements.
-- Ghi bằng trigger trên product_variants (thêm / đổi stock / xóa), nên không đường nào đổi tồn mà lọt sổ.
-- Hàm SQL đổi tồn gọi set_stock_context(...) trước để trigger biết loại, đơn / phiếu liên quan;
-- không có ngữ cảnh (sửa thẳng bảng) thì ghi "Điều chỉnh · Sửa trực tiếp".

create type public.stock_movement_kind as enum ('initial', 'receipt', 'sale', 'return', 'adjust');
create type public.stock_adjust_reason as enum ('damaged', 'count', 'other');

-- ============================================================
-- Phiếu nhập kho — mã dạng "PN-0001"
-- ============================================================
create sequence public.stock_receipt_code_seq start with 1;

create table public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('PN-' || lpad(nextval('public.stock_receipt_code_seq')::text, 4, '0')),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_receipts_created_at_idx on public.stock_receipts (created_at desc);

create table public.stock_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.stock_receipts (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  variant_snapshot text,
  sku_snapshot text not null,
  qty integer not null check (qty > 0),
  sort_order integer not null default 0
);
create index stock_receipt_items_receipt_id_idx on public.stock_receipt_items (receipt_id);
create index stock_receipt_items_product_id_idx on public.stock_receipt_items (product_id);

-- ============================================================
-- Sổ kho. Giữ tên / phân loại / SKU lúc ghi để vẫn đọc được khi phân loại đã xóa.
-- created_at dùng clock_timestamp(): nhiều dòng trong cùng một giao dịch vẫn đúng thứ tự.
-- ============================================================
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  variant_snapshot text,
  sku_snapshot text not null,
  kind public.stock_movement_kind not null,
  reason public.stock_adjust_reason,
  note text,
  delta integer not null check (delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  order_id uuid references public.orders (id) on delete cascade,
  receipt_id uuid references public.stock_receipts (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  check ((kind = 'adjust') = (reason is not null))
);
create index stock_movements_product_created_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_order_id_idx on public.stock_movements (order_id);
create index stock_movements_receipt_id_idx on public.stock_movements (receipt_id);

-- ============================================================
-- Ngữ cảnh cho trigger trong giao dịch hiện tại (set_config ... is_local = true)
-- ============================================================
create or replace function public.set_stock_context(
  p_kind public.stock_movement_kind,
  p_order_id uuid default null,
  p_receipt_id uuid default null,
  p_reason public.stock_adjust_reason default null,
  p_note text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.stock_ctx', jsonb_strip_nulls(jsonb_build_object(
    'kind', p_kind, 'order_id', p_order_id, 'receipt_id', p_receipt_id, 'reason', p_reason, 'note', p_note
  ))::text, true);
end;
$$;

revoke execute on function public.set_stock_context(public.stock_movement_kind, uuid, uuid, public.stock_adjust_reason, text) from public, anon;
grant execute on function public.set_stock_context(public.stock_movement_kind, uuid, uuid, public.stock_adjust_reason, text) to authenticated;

-- ============================================================
-- Trigger ghi sổ. security definer: người gọi không có quyền ghi thẳng vào stock_movements.
--   INSERT có tồn > 0  → Tồn đầu
--   UPDATE stock        → theo ngữ cảnh; không có thì Điều chỉnh · Sửa trực tiếp
--   DELETE có tồn > 0   → Điều chỉnh · Xóa biến thể (bỏ qua khi xóa theo sản phẩm)
-- ============================================================
create or replace function public.log_stock_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx jsonb := nullif(current_setting('app.stock_ctx', true), '')::jsonb;
  v_row public.product_variants%rowtype;
  v_delta integer;
  v_after integer;
  v_kind public.stock_movement_kind;
  v_reason public.stock_adjust_reason;
  v_note text;
  v_order_id uuid;
  v_receipt_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    -- Xóa theo sản phẩm (cascade): sản phẩm đã mất, không ghi
    if old.stock = 0 or not exists (select 1 from public.products where id = old.product_id) then
      return old;
    end if;
    v_delta := -old.stock;
    v_after := 0;
    v_kind := 'adjust';
    v_reason := 'other';
    v_note := 'Xóa biến thể';
  elsif tg_op = 'INSERT' then
    v_row := new;
    if new.stock = 0 then
      return new;
    end if;
    v_delta := new.stock;
    v_after := new.stock;
    v_kind := 'initial';
  else
    v_row := new;
    if new.stock = old.stock then
      return new;
    end if;
    v_delta := new.stock - old.stock;
    v_after := new.stock;
    if v_ctx is null then
      v_kind := 'adjust';
      v_reason := 'other';
      v_note := 'Sửa trực tiếp';
    else
      v_kind := (v_ctx ->> 'kind')::public.stock_movement_kind;
      v_reason := (v_ctx ->> 'reason')::public.stock_adjust_reason;
      v_note := v_ctx ->> 'note';
      v_order_id := (v_ctx ->> 'order_id')::uuid;
      v_receipt_id := (v_ctx ->> 'receipt_id')::uuid;
    end if;
  end if;

  insert into public.stock_movements (
    variant_id, product_id, name_snapshot, variant_snapshot, sku_snapshot,
    kind, reason, note, delta, stock_after, order_id, receipt_id
  )
  select
    case when tg_op = 'DELETE' then null else v_row.id end,
    v_row.product_id,
    p.name,
    coalesce(
      public.variant_label(v_row.id),
      (select nullif(string_agg(x.value, ' · '), '') from jsonb_each_text(v_row.option_values) x)
    ),
    v_row.sku,
    v_kind, v_reason, v_note, v_delta, v_after, v_order_id, v_receipt_id
  from public.products p
  where p.id = v_row.product_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.log_stock_change() from public, anon, authenticated;

create trigger product_variants_stock_log
  after insert or update of stock on public.product_variants
  for each row execute function public.log_stock_change();

create trigger product_variants_stock_log_delete
  before delete on public.product_variants
  for each row execute function public.log_stock_change();

-- ============================================================
-- Hàm cũ sửa lại (chép từ migration gốc, chỉ thêm / bớt dòng liên quan tới sổ kho)
-- ============================================================

-- admin_save_product (20261029000005): không ghi stock của phân loại đã có — tồn chỉ đổi qua phiếu nhập, điều chỉnh, đơn.
-- Phân loại mới vẫn nhận tồn ban đầu (trigger ghi Tồn đầu); phân loại bị xóa còn hàng được trigger ghi Xóa biến thể.
create or replace function public.admin_save_product(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_option_id uuid;
  v_option record;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được sửa sản phẩm' using errcode = '42501';
  end if;

  insert into public.products as t (
    id, name, slug, category_id, description, material, dimensions, bulb, extra_specs, care_instructions,
    base_price, compare_at_price, status, is_featured, badge, low_stock_threshold,
    material_tags, color_tags, spaces, seo_description
  ) values (
    v_id,
    p ->> 'name',
    p ->> 'slug',
    nullif(p ->> 'category_id', '')::uuid,
    nullif(p ->> 'description', ''),
    nullif(p ->> 'material', ''),
    nullif(p ->> 'dimensions', ''),
    nullif(p ->> 'bulb', ''),
    coalesce(p -> 'extra_specs', '[]'::jsonb),
    nullif(p ->> 'care_instructions', ''),
    coalesce((p ->> 'base_price')::bigint, 0),
    nullif(p ->> 'compare_at_price', '')::bigint,
    (p ->> 'status')::public.product_status,
    coalesce((p ->> 'is_featured')::boolean, false),
    coalesce(p ->> 'badge', 'none')::public.product_badge,
    nullif(p ->> 'low_stock_threshold', '')::integer,
    coalesce(array(select jsonb_array_elements_text(p -> 'material_tags')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p -> 'color_tags')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p -> 'spaces')), '{}'),
    nullif(p ->> 'seo_description', '')
  )
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    category_id = excluded.category_id,
    description = excluded.description,
    material = excluded.material,
    dimensions = excluded.dimensions,
    bulb = excluded.bulb,
    extra_specs = excluded.extra_specs,
    care_instructions = excluded.care_instructions,
    base_price = excluded.base_price,
    compare_at_price = excluded.compare_at_price,
    status = excluded.status,
    is_featured = excluded.is_featured,
    badge = excluded.badge,
    low_stock_threshold = excluded.low_stock_threshold,
    material_tags = excluded.material_tags,
    color_tags = excluded.color_tags,
    spaces = excluded.spaces,
    seo_description = excluded.seo_description;

  -- Nhóm phân loại: ghi lại toàn bộ
  delete from public.product_options where product_id = v_id;
  for v_option in
    select item, ord from jsonb_array_elements(coalesce(p -> 'options', '[]'::jsonb)) with ordinality as x(item, ord)
  loop
    insert into public.product_options (product_id, name, sort_order)
    values (v_id, v_option.item ->> 'name', v_option.ord)
    returning id into v_option_id;

    insert into public.product_option_values (option_id, value, hex, sort_order)
    select v_option_id, val ->> 'value', nullif(val ->> 'hex', ''), vord
    from jsonb_array_elements(coalesce(v_option.item -> 'values', '[]'::jsonb)) with ordinality as y(val, vord);
  end loop;

  -- SKU: xóa dòng không còn, cập nhật dòng cũ, thêm dòng mới
  delete from public.product_variants v
  where v.product_id = v_id
    and v.id not in (
      select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(p -> 'variants', '[]'::jsonb)) x
      where nullif(x ->> 'id', '') is not null
    );

  update public.product_variants v set
    sku = x.item ->> 'sku',
    price = (x.item ->> 'price')::bigint,
    is_active = coalesce((x.item ->> 'is_active')::boolean, true),
    option_values = coalesce(x.item -> 'option_values', '{}'::jsonb),
    sort_order = x.ord
  from jsonb_array_elements(coalesce(p -> 'variants', '[]'::jsonb)) with ordinality as x(item, ord)
  where nullif(x.item ->> 'id', '') is not null
    and v.id = (x.item ->> 'id')::uuid
    and v.product_id = v_id;

  insert into public.product_variants (product_id, sku, price, stock, is_active, option_values, sort_order)
  select v_id, x.item ->> 'sku', (x.item ->> 'price')::bigint, (x.item ->> 'stock')::integer,
         coalesce((x.item ->> 'is_active')::boolean, true), coalesce(x.item -> 'option_values', '{}'::jsonb), x.ord
  from jsonb_array_elements(coalesce(p -> 'variants', '[]'::jsonb)) with ordinality as x(item, ord)
  where nullif(x.item ->> 'id', '') is null;

  -- Ảnh: ghi lại theo thứ tự, ảnh đầu là bìa (file trong Storage do Server Action xóa)
  delete from public.product_images where product_id = v_id;
  insert into public.product_images (product_id, storage_path, sort_order, is_cover)
  select v_id, x.item ->> 'storage_path', x.ord, x.ord = 1
  from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) with ordinality as x(item, ord);

  return v_id;
end;
$$;

revoke execute on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- admin_save_order (20261029000006): sửa đơn → trả kho món cũ (Hủy / trả), trừ kho món mới (Bán)
create or replace function public.admin_save_order(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v_order public.orders%rowtype;
  v_customer_id uuid := nullif(p #>> '{customer,id}', '')::uuid;
  v_name text := nullif(trim(p #>> '{customer,name}'), '');
  v_phone text := nullif(trim(p #>> '{customer,phone}'), '');
  v_address text := nullif(trim(p #>> '{customer,address}'), '');
  v_channel public.sales_channel := (p ->> 'channel')::public.sales_channel;
  v_discount bigint := coalesce((p ->> 'discount')::bigint, 0);
  v_shipping bigint := coalesce((p ->> 'shipping_fee')::bigint, 0);
  v_subtotal bigint;
  v_item record;
  v_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được sửa đơn hàng' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Nhập tên khách hàng.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Đơn cần ít nhất 1 sản phẩm.' using errcode = 'P0001';
  end if;

  -- Sửa đơn: khóa dòng, trả lại kho đã trừ, xóa món cũ
  if not v_is_new then
    select * into v_order from public.orders where id = v_id for update;
    if not found then
      raise exception 'Không tìm thấy đơn hàng.' using errcode = 'P0001';
    end if;
    if v_order.status <> 'pending' then
      raise exception 'Chỉ sửa được đơn đang chờ xác nhận.' using errcode = 'P0001';
    end if;
    if v_order.stock_deducted then
      perform public.set_stock_context('return', v_id, p_note => 'Sửa đơn ' || v_order.code);
      update public.product_variants v set stock = v.stock + x.qty
      from (select variant_id, sum(qty)::integer as qty from public.order_items
            where order_id = v_id and variant_id is not null group by variant_id) x
      where v.id = x.variant_id;
    end if;
    delete from public.order_items where order_id = v_id;
  end if;

  -- Khách: chọn sẵn thì cập nhật, chưa chọn thì tìm theo SĐT, không có thì tạo mới
  if v_customer_id is null and v_phone is not null then
    select id into v_customer_id from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    order by created_at
    limit 1;
  end if;
  if v_customer_id is null then
    insert into public.customers (name, phone, address, channel)
    values (v_name, v_phone, v_address, v_channel)
    returning id into v_customer_id;
  else
    update public.customers set
      name = v_name,
      phone = coalesce(v_phone, phone),
      address = coalesce(v_address, address)
    where id = v_customer_id;
    if not found then
      raise exception 'Không tìm thấy khách hàng.' using errcode = 'P0001';
    end if;
  end if;

  if v_is_new then
    insert into public.orders (customer_id, channel, payment, note, discount, shipping_fee, stock_deducted)
    values (v_customer_id, v_channel, (p ->> 'payment')::public.payment_method, nullif(trim(p ->> 'note'), ''),
            v_discount, v_shipping, true)
    returning * into v_order;
    v_id := v_order.id;
  end if;

  -- Món: chụp lại tên + phân loại lúc bán, trừ kho (gộp các dòng trùng SKU)
  perform public.set_stock_context('sale', v_id);
  for v_item in
    select (x.item ->> 'variant_id')::uuid as variant_id,
           sum((x.item ->> 'qty')::integer)::integer as qty,
           max((x.item ->> 'unit_price')::bigint) as unit_price,
           min(x.ord) as ord
    from jsonb_array_elements(p -> 'items') with ordinality as x(item, ord)
    group by 1
    order by 4
  loop
    update public.product_variants set stock = stock - v_item.qty
    where id = v_item.variant_id and stock >= v_item.qty;
    if not found then
      select stock into v_stock from public.product_variants where id = v_item.variant_id;
      if v_stock is null then
        raise exception 'Có sản phẩm trong đơn không còn tồn tại.' using errcode = 'P0001';
      end if;
      raise exception 'SKU % chỉ còn % trong kho.',
        (select sku from public.product_variants where id = v_item.variant_id), v_stock using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order)
    select v_id, v.id, pr.name, public.variant_label(v.id), v_item.unit_price, v_item.qty, v_item.ord
    from public.product_variants v
    join public.products pr on pr.id = v.product_id
    where v.id = v_item.variant_id;
  end loop;

  select coalesce(sum(unit_price * qty), 0)::bigint into v_subtotal from public.order_items where order_id = v_id;
  if v_discount > v_subtotal then
    raise exception 'Giảm giá không được lớn hơn tạm tính.' using errcode = 'P0001';
  end if;

  update public.orders set
    customer_id = v_customer_id,
    channel = v_channel,
    payment = (p ->> 'payment')::public.payment_method,
    note = nullif(trim(p ->> 'note'), ''),
    discount = v_discount,
    shipping_fee = v_shipping,
    subtotal = v_subtotal,
    total = v_subtotal - v_discount + v_shipping,
    stock_deducted = true
  where id = v_id
  returning * into v_order;

  insert into public.order_events (order_id, status, note, created_by)
  values (
    v_id,
    case when v_is_new then 'pending'::public.order_status end,
    case when v_is_new then 'Tạo đơn' else 'Sửa đơn' end,
    (select auth.uid())
  );

  return jsonb_build_object('id', v_order.id, 'code', v_order.code);
end;
$$;

revoke execute on function public.admin_save_order(jsonb) from public, anon;
grant execute on function public.admin_save_order(jsonb) to authenticated;

-- admin_set_order_status (20261029000006): hủy / khách trả → cộng lại kho (Hủy / trả)
create or replace function public.admin_set_order_status(p_ids uuid[], p_status public.order_status, p_note text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order record;
  v_changed integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được sửa đơn hàng' using errcode = '42501';
  end if;

  for v_order in
    select id, status, stock_deducted from public.orders where id = any (p_ids) order by created_at for update
  loop
    if not (
      (v_order.status = 'pending' and p_status in ('packing', 'cancelled'))
      or (v_order.status = 'packing' and p_status in ('shipping', 'cancelled'))
      or (v_order.status = 'shipping' and p_status in ('done', 'returned', 'cancelled'))
      or (v_order.status = 'done' and p_status = 'returned')
    ) then
      continue;
    end if;

    if p_status in ('cancelled', 'returned') and v_order.stock_deducted then
      perform public.set_stock_context('return', v_order.id, p_note => case p_status when 'cancelled' then 'Hủy đơn' else 'Khách trả hàng' end);
      update public.product_variants v set stock = v.stock + x.qty
      from (select variant_id, sum(qty)::integer as qty from public.order_items
            where order_id = v_order.id and variant_id is not null group by variant_id) x
      where v.id = x.variant_id;
    end if;

    update public.orders set
      status = p_status,
      stock_deducted = stock_deducted and p_status not in ('cancelled', 'returned')
    where id = v_order.id;

    insert into public.order_events (order_id, status, note, created_by)
    values (v_order.id, p_status, nullif(trim(p_note), ''), (select auth.uid()));
    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke execute on function public.admin_set_order_status(uuid[], public.order_status, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid[], public.order_status, text) to authenticated;

-- quote_create_order (20261029000007): báo giá thành đơn → trừ kho (Bán)
create or replace function public.quote_create_order(p_quote_id uuid, p_payment public.payment_method, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_stock integer;
  v_discount bigint;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Không tìm thấy báo giá.' using errcode = 'P0001';
  end if;
  if v_quote.order_id is not null then
    raise exception 'Báo giá này đã thành đơn.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then
    raise exception 'Báo giá chưa có sản phẩm.' using errcode = 'P0001';
  end if;

  insert into public.orders (customer_id, channel, payment, note, source_quote_id, stock_deducted)
  values (v_quote.customer_id, v_quote.channel, p_payment, 'Từ báo giá ' || v_quote.code, v_quote.id, true)
  returning * into v_order;

  perform public.set_stock_context('sale', v_order.id);
  for v_item in
    select * from public.quote_items where quote_id = p_quote_id order by sort_order, name_snapshot
  loop
    if v_item.variant_id is null then
      raise exception '"%" không còn bán — sửa báo giá rồi thử lại.', v_item.name_snapshot using errcode = 'P0001';
    end if;
    update public.product_variants set stock = stock - v_item.qty
    where id = v_item.variant_id and stock >= v_item.qty;
    if not found then
      select stock into v_stock from public.product_variants where id = v_item.variant_id;
      raise exception 'SKU % chỉ còn % trong kho.',
        (select sku from public.product_variants where id = v_item.variant_id), coalesce(v_stock, 0) using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order)
    values (v_order.id, v_item.variant_id, v_item.name_snapshot, v_item.variant_snapshot, v_item.unit_price, v_item.qty, v_item.sort_order);
  end loop;

  v_discount := round(v_quote.subtotal * v_quote.discount_percent / 100)::bigint;
  update public.orders set
    subtotal = v_quote.subtotal,
    discount = v_discount,
    shipping_fee = v_quote.shipping_fee,
    total = v_quote.subtotal - v_discount + v_quote.shipping_fee
  where id = v_order.id;

  insert into public.order_events (order_id, status, note, created_by)
  values (v_order.id, 'pending', 'Tạo từ báo giá ' || v_quote.code, p_actor);

  update public.quotes set
    status = 'ordered',
    order_id = v_order.id,
    accepted_at = coalesce(accepted_at, now())
  where id = p_quote_id;

  return jsonb_build_object('id', v_order.id, 'code', v_order.code);
end;
$$;

revoke execute on function public.quote_create_order(uuid, public.payment_method, uuid) from public, anon, authenticated;

-- ============================================================
-- Điều chỉnh tồn một phân loại (vỡ / hỏng, kiểm kê lệch, khác). Trả về tồn mới.
-- ============================================================
create or replace function public.admin_adjust_stock(
  p_variant_id uuid,
  p_delta integer,
  p_reason public.stock_adjust_reason,
  p_note text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note text := nullif(trim(p_note), '');
  v_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được điều chỉnh tồn kho' using errcode = '42501';
  end if;
  if coalesce(p_delta, 0) = 0 then
    raise exception 'Nhập số thay đổi khác 0.' using errcode = 'P0001';
  end if;
  if p_reason is null then
    raise exception 'Chọn lý do điều chỉnh.' using errcode = 'P0001';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'Chọn "Khác" thì cần ghi chú lý do.' using errcode = 'P0001';
  end if;

  perform public.set_stock_context('adjust', p_reason => p_reason, p_note => v_note);
  update public.product_variants set stock = stock + p_delta
  where id = p_variant_id and stock + p_delta >= 0
  returning stock into v_stock;
  if not found then
    select stock into v_stock from public.product_variants where id = p_variant_id;
    if v_stock is null then
      raise exception 'Không tìm thấy phân loại.' using errcode = 'P0001';
    end if;
    raise exception 'Tồn sau điều chỉnh không được âm (hiện còn %).', v_stock using errcode = 'P0001';
  end if;

  return v_stock;
end;
$$;

revoke execute on function public.admin_adjust_stock(uuid, integer, public.stock_adjust_reason, text) from public, anon;
grant execute on function public.admin_adjust_stock(uuid, integer, public.stock_adjust_reason, text) to authenticated;

-- ============================================================
-- Lập phiếu nhập: cộng kho mọi dòng trong một transaction. Dòng trùng phân loại được gộp.
-- p: { note, items: [{ variant_id, qty }] } → { id, code }. Phiếu đã lưu không sửa / xóa.
-- ============================================================
create or replace function public.admin_create_stock_receipt(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_receipt public.stock_receipts%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được nhập kho' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Phiếu nhập cần ít nhất 1 sản phẩm.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p -> 'items') x
    where coalesce((x ->> 'qty')::integer, 0) not between 1 and 100000
  ) then
    raise exception 'Số lượng nhập phải từ 1 đến 100000.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p -> 'items') x
    where not exists (select 1 from public.product_variants v where v.id = nullif(x ->> 'variant_id', '')::uuid)
  ) then
    raise exception 'Có sản phẩm trong phiếu không còn tồn tại.' using errcode = 'P0001';
  end if;

  insert into public.stock_receipts (note, created_by)
  values (nullif(trim(p ->> 'note'), ''), (select auth.uid()))
  returning * into v_receipt;

  insert into public.stock_receipt_items (receipt_id, variant_id, product_id, name_snapshot, variant_snapshot, sku_snapshot, qty, sort_order)
  select v_receipt.id, v.id, v.product_id, pr.name, public.variant_label(v.id), v.sku, x.qty, x.ord
  from (
    select (t.item ->> 'variant_id')::uuid as variant_id, sum((t.item ->> 'qty')::integer)::integer as qty, min(t.ord) as ord
    from jsonb_array_elements(p -> 'items') with ordinality as t(item, ord)
    group by 1
  ) x
  join public.product_variants v on v.id = x.variant_id
  join public.products pr on pr.id = v.product_id;

  perform public.set_stock_context('receipt', p_receipt_id => v_receipt.id, p_note => v_receipt.code);
  update public.product_variants v set stock = v.stock + i.qty
  from public.stock_receipt_items i
  where i.receipt_id = v_receipt.id and v.id = i.variant_id;

  return jsonb_build_object('id', v_receipt.id, 'code', v_receipt.code);
end;
$$;

revoke execute on function public.admin_create_stock_receipt(jsonb) from public, anon;
grant execute on function public.admin_create_stock_receipt(jsonb) to authenticated;

-- ============================================================
-- Danh sách cho admin: lịch sử kho, phiếu nhập (cột tìm kiếm không dấu)
-- ============================================================
create or replace view public.stock_movement_list with (security_invoker = true) as
select
  m.id,
  m.variant_id,
  m.product_id,
  m.name_snapshot,
  m.variant_snapshot,
  m.sku_snapshot,
  m.kind,
  m.reason,
  m.note,
  m.delta,
  m.stock_after,
  m.order_id,
  m.receipt_id,
  m.created_by,
  m.created_at,
  coalesce(p.name, m.name_snapshot) as product_name,
  o.code as order_code,
  r.code as receipt_code,
  pf.full_name as actor_name,
  lower(extensions.unaccent('extensions.unaccent'::regdictionary, concat_ws(' ',
    coalesce(p.name, m.name_snapshot), m.variant_snapshot, m.sku_snapshot, o.code, r.code, m.note
  ))) as search
from public.stock_movements m
left join public.products p on p.id = m.product_id
left join public.orders o on o.id = m.order_id
left join public.stock_receipts r on r.id = m.receipt_id
left join public.profiles pf on pf.id = m.created_by;

create or replace view public.stock_receipt_list with (security_invoker = true) as
select
  r.id,
  r.code,
  r.note,
  r.created_by,
  r.created_at,
  coalesce(i.item_count, 0) as item_count,
  coalesce(i.total_qty, 0) as total_qty,
  i.items_summary,
  pf.full_name as actor_name,
  lower(extensions.unaccent('extensions.unaccent'::regdictionary, concat_ws(' ',
    r.code, r.note, i.items_summary, i.skus
  ))) as search
from public.stock_receipts r
left join lateral (
  select
    count(*)::integer as item_count,
    sum(qty)::integer as total_qty,
    string_agg(name_snapshot || coalesce(' · ' || variant_snapshot, '') || ' ×' || qty, ', ' order by sort_order) as items_summary,
    string_agg(sku_snapshot, ' ') as skus
  from public.stock_receipt_items
  where receipt_id = r.id
) i on true
left join public.profiles pf on pf.id = r.created_by;

-- ============================================================
-- Quyền: chỉ admin đọc; phiếu nhập ghi qua hàm (security invoker); sổ kho chỉ trigger ghi
-- ============================================================
alter table public.stock_receipts enable row level security;
alter table public.stock_receipt_items enable row level security;
alter table public.stock_movements enable row level security;

grant select, insert on public.stock_receipts, public.stock_receipt_items to authenticated;
grant usage, select on sequence public.stock_receipt_code_seq to authenticated;
grant select on public.stock_movements to authenticated;
revoke insert, update, delete on public.stock_movements from anon, authenticated;
grant select on public.stock_movement_list, public.stock_receipt_list to authenticated;

create policy "Admin xem phiếu nhập" on public.stock_receipts
  for select to authenticated using ((select public.is_admin()));
create policy "Admin lập phiếu nhập" on public.stock_receipts
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admin xem dòng phiếu nhập" on public.stock_receipt_items
  for select to authenticated using ((select public.is_admin()));
create policy "Admin thêm dòng phiếu nhập" on public.stock_receipt_items
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admin xem sổ kho" on public.stock_movements
  for select to authenticated using ((select public.is_admin()));

-- ============================================================
-- Dữ liệu cũ: một dòng Tồn đầu cho mỗi phân loại đang có hàng, để sổ khớp tồn từ hôm nay
-- ============================================================
insert into public.stock_movements (variant_id, product_id, name_snapshot, variant_snapshot, sku_snapshot, kind, note, delta, stock_after, created_by)
select v.id, v.product_id, p.name, public.variant_label(v.id), v.sku, 'initial', 'Tồn đầu khi bật sổ kho', v.stock, v.stock, null
from public.product_variants v
join public.products p on p.id = v.product_id
where v.stock > 0;
