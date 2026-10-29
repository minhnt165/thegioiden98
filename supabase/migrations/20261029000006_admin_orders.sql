-- Quản lý đơn hàng ở admin (giai đoạn 4)
-- Kho: trừ tồn khi tạo đơn, cộng lại khi hủy / khách trả hàng. Đơn trong seed tạo trước khi có quy tắc này
-- nên stock_deducted = false: hủy các đơn đó không cộng kho (vì chưa từng trừ).

create extension if not exists unaccent with schema extensions;

alter table public.orders add column stock_deducted boolean not null default false;
alter table public.order_items add column sort_order integer not null default 0;

-- ============================================================
-- Lịch sử đơn: mỗi lần đổi trạng thái / sửa đơn ghi một dòng
-- ============================================================
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status,             -- null: sự kiện không đổi trạng thái (sửa đơn)
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_id_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;
grant select, insert, update, delete on public.order_events to authenticated;
create policy "Admin quản lý lịch sử đơn" on public.order_events
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Lịch sử cho đơn đã có: lúc tạo, và trạng thái hiện tại (nếu đã đi tiếp)
insert into public.order_events (order_id, status, note, created_at)
select id, 'pending', 'Tạo đơn', created_at from public.orders;
insert into public.order_events (order_id, status, created_at)
select id, status, updated_at from public.orders where status <> 'pending';

-- ============================================================
-- Danh sách đơn cho admin: tên/SĐT khách, tóm tắt món, cột tìm kiếm không dấu
-- ============================================================
create or replace view public.order_list with (security_invoker = true) as
select
  o.id,
  o.code,
  o.status,
  o.channel,
  o.payment,
  o.subtotal,
  o.discount,
  o.shipping_fee,
  o.total,
  o.note,
  o.created_at,
  o.customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  c.address as customer_address,
  i.items_summary,
  i.first_variant,
  i.item_count,
  i.first_product_id,
  lower(extensions.unaccent('extensions.unaccent'::regdictionary, concat_ws(' ',
    o.code, c.name, c.phone, regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), i.items_summary
  ))) as search
from public.orders o
left join public.customers c on c.id = o.customer_id
left join lateral (
  select
    string_agg(oi.name_snapshot || ' ×' || oi.qty, ', ' order by oi.sort_order, oi.name_snapshot) as items_summary,
    (array_agg(oi.variant_snapshot order by oi.sort_order, oi.name_snapshot))[1] as first_variant,
    count(*)::integer as item_count,
    (array_agg(v.product_id order by oi.sort_order, oi.name_snapshot))[1] as first_product_id
  from public.order_items oi
  left join public.product_variants v on v.id = oi.variant_id
  where oi.order_id = o.id
) i on true;

grant select on public.order_list to authenticated;

-- ============================================================
-- Nhãn phân loại "Kem lanh · Nhỏ" theo thứ tự nhóm phân loại
-- ============================================================
create or replace function public.variant_label(p_variant_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(string_agg(v.option_values ->> o.name, ' · ' order by o.sort_order), '')
  from public.product_variants v
  join public.product_options o on o.product_id = v.product_id
  where v.id = p_variant_id and v.option_values ? o.name;
$$;

revoke execute on function public.variant_label(uuid) from public, anon;
grant execute on function public.variant_label(uuid) to authenticated;

-- ============================================================
-- Tạo / sửa đơn thủ công trong một transaction
-- p: { id?, customer: { id?, name, phone, address }, channel, payment, discount, shipping_fee, note,
--      items: [{ variant_id, qty, unit_price }] }
-- Sửa chỉ được khi đơn đang chờ xác nhận. Trả về { id, code }.
-- ============================================================
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

-- ============================================================
-- Đổi trạng thái nhiều đơn. Đơn không được phép chuyển sang trạng thái đích thì bỏ qua.
-- Hủy / trả hàng: cộng lại kho đã trừ. Trả về số đơn đã đổi.
--   pending  → packing, cancelled
--   packing  → shipping, cancelled
--   shipping → done, returned, cancelled
--   done     → returned
-- ============================================================
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
