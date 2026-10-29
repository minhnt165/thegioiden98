-- Báo giá (giai đoạn 5)
-- Admin lập báo giá, gửi link /bg/<public_token>. Khách bấm "Đồng ý" → tự tạo đơn chờ xác nhận (trừ kho như đơn thủ công).
-- Thiếu hàng lúc khách đồng ý thì báo giá dừng ở "Khách đồng ý", shop sửa rồi bấm "Chuyển thành đơn hàng".
-- Hết hạn tính theo valid_until (giờ Việt Nam): báo giá đã gửi mà quá ngày được coi là "expired" dù cột status chưa đổi.

-- Kênh khách hỏi (tạo đơn từ báo giá dùng kênh này)
alter table public.quotes add column channel public.sales_channel not null default 'zalo';
update public.quotes q set channel = c.channel from public.customers c where c.id = q.customer_id;

-- ============================================================
-- Ngày hôm nay theo giờ Việt Nam
-- ============================================================
create or replace function public.vn_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

grant execute on function public.vn_today() to anon, authenticated;

-- ============================================================
-- Danh sách báo giá cho admin: trạng thái thực tế (đã tính hết hạn), khách, tóm tắt món, cột tìm không dấu
-- ============================================================
create or replace view public.quote_list with (security_invoker = true) as
select
  q.id,
  q.code,
  case
    when q.status in ('sent', 'viewed') and q.valid_until < public.vn_today() then 'expired'::public.quote_status
    else q.status
  end as status,
  q.channel,
  q.subtotal,
  q.total,
  q.valid_until,
  q.view_count,
  q.sent_at,
  q.viewed_at,
  q.accepted_at,
  q.order_id,
  q.created_at,
  q.customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  i.items_summary,
  lower(extensions.unaccent('extensions.unaccent'::regdictionary, concat_ws(' ',
    q.code, c.name, c.phone, regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), i.items_summary
  ))) as search
from public.quotes q
left join public.customers c on c.id = q.customer_id
left join lateral (
  select string_agg(qi.name_snapshot || ' ×' || qi.qty, ', ' order by qi.sort_order, qi.name_snapshot) as items_summary
  from public.quote_items qi
  where qi.quote_id = q.id
) i on true;

grant select on public.quote_list to authenticated;

-- ============================================================
-- Tạo / sửa báo giá trong một transaction
-- p: { id?, customer: { id?, name, phone, address }, channel, message, terms, discount_percent, shipping_fee,
--      valid_until, send, items: [{ variant_id, qty, unit_price }] }
-- send = true: báo giá nháp / hết hạn chuyển sang "đã gửi". Sửa được khi chưa chốt (nháp, đã gửi, đã xem, hết hạn).
-- Không đụng tới kho. Trả về { id, code, public_token, status }.
-- ============================================================
create or replace function public.admin_save_quote(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v_quote public.quotes%rowtype;
  v_customer_id uuid := nullif(p #>> '{customer,id}', '')::uuid;
  v_name text := nullif(trim(p #>> '{customer,name}'), '');
  v_phone text := nullif(trim(p #>> '{customer,phone}'), '');
  v_address text := nullif(trim(p #>> '{customer,address}'), '');
  v_channel public.sales_channel := (p ->> 'channel')::public.sales_channel;
  v_percent numeric(5, 2) := coalesce((p ->> 'discount_percent')::numeric, 0);
  v_shipping bigint := coalesce((p ->> 'shipping_fee')::bigint, 0);
  v_valid_until date := nullif(p ->> 'valid_until', '')::date;
  v_send boolean := coalesce((p ->> 'send')::boolean, false);
  v_status public.quote_status;
  v_subtotal bigint;
  v_missing integer;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được sửa báo giá' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Nhập tên khách hàng.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Báo giá cần ít nhất 1 sản phẩm.' using errcode = 'P0001';
  end if;
  if v_valid_until is null then
    raise exception 'Chọn ngày hết hiệu lực.' using errcode = 'P0001';
  end if;

  if not v_is_new then
    select * into v_quote from public.quotes where id = v_id for update;
    if not found then
      raise exception 'Không tìm thấy báo giá.' using errcode = 'P0001';
    end if;
    if v_quote.status not in ('draft', 'sent', 'viewed', 'expired') then
      raise exception 'Báo giá đã chốt hoặc đã đóng, không sửa được nữa.' using errcode = 'P0001';
    end if;
  end if;

  -- Khách: chọn sẵn thì cập nhật, chưa chọn thì tìm theo SĐT, không có thì tạo mới (giống admin_save_order)
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
    insert into public.quotes (customer_id, channel, valid_until, created_by)
    values (v_customer_id, v_channel, v_valid_until, (select auth.uid()))
    returning * into v_quote;
    v_id := v_quote.id;
  else
    delete from public.quote_items where quote_id = v_id;
  end if;

  -- Món: chụp lại tên + phân loại lúc báo giá
  insert into public.quote_items (quote_id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order)
  select v_id, v.id, pr.name, public.variant_label(v.id), (x.item ->> 'unit_price')::bigint, (x.item ->> 'qty')::integer, x.ord
  from jsonb_array_elements(p -> 'items') with ordinality as x(item, ord)
  join public.product_variants v on v.id = (x.item ->> 'variant_id')::uuid
  join public.products pr on pr.id = v.product_id;
  get diagnostics v_missing = row_count;
  if v_missing <> jsonb_array_length(p -> 'items') then
    raise exception 'Có sản phẩm trong báo giá không còn tồn tại.' using errcode = 'P0001';
  end if;

  select coalesce(sum(unit_price * qty), 0)::bigint into v_subtotal from public.quote_items where quote_id = v_id;

  -- Trạng thái: gửi đi thì nháp / hết hạn → đã gửi; gia hạn một báo giá đã hết hạn cũng coi như gửi lại
  v_status := v_quote.status;
  if v_send and v_status in ('draft', 'expired') then
    v_status := 'sent';
  elsif v_status = 'expired' and v_valid_until >= public.vn_today() then
    v_status := 'sent';
  end if;

  update public.quotes set
    customer_id = v_customer_id,
    channel = v_channel,
    message = nullif(trim(p ->> 'message'), ''),
    terms = nullif(trim(p ->> 'terms'), ''),
    discount_percent = v_percent,
    shipping_fee = v_shipping,
    valid_until = v_valid_until,
    subtotal = v_subtotal,
    total = v_subtotal - round(v_subtotal * v_percent / 100)::bigint + v_shipping,
    status = v_status,
    sent_at = case when v_status = 'sent' and v_quote.status in ('draft', 'expired') then now() else sent_at end
  where id = v_id
  returning * into v_quote;

  return jsonb_build_object('id', v_quote.id, 'code', v_quote.code, 'public_token', v_quote.public_token, 'status', v_quote.status);
end;
$$;

revoke execute on function public.admin_save_quote(jsonb) from public, anon;
grant execute on function public.admin_save_quote(jsonb) to authenticated;

-- ============================================================
-- Nội bộ: tạo đơn chờ xác nhận từ báo giá (giá, giảm giá, phí giao theo báo giá), trừ kho.
-- Chỉ gọi qua admin_quote_to_order / public_accept_quote — không cấp quyền gọi trực tiếp.
-- ============================================================
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
-- Admin chuyển báo giá thành đơn (khách chốt qua Zalo / tại showroom, hoặc khách đã bấm đồng ý mà thiếu hàng)
-- ============================================================
create or replace function public.admin_quote_to_order(p_id uuid, p_payment public.payment_method default 'cod')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.quote_status;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được tạo đơn' using errcode = '42501';
  end if;
  select status into v_status from public.quotes where id = p_id;
  if v_status = 'ordered' then
    raise exception 'Báo giá này đã thành đơn.' using errcode = 'P0001';
  end if;
  if v_status = 'rejected' then
    raise exception 'Khách đã từ chối báo giá này.' using errcode = 'P0001';
  end if;
  return public.quote_create_order(p_id, p_payment, (select auth.uid()));
end;
$$;

revoke execute on function public.admin_quote_to_order(uuid, public.payment_method) from public, anon;
grant execute on function public.admin_quote_to_order(uuid, public.payment_method) to authenticated;

-- ============================================================
-- Trang khách /bg/<token> (gọi bằng service role từ server)
-- ============================================================

-- Khách mở link: đếm lượt xem, lần đầu thì "đã gửi" → "khách đã xem"
create or replace function public.public_view_quote(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quotes set
    view_count = view_count + 1,
    viewed_at = coalesce(viewed_at, now()),
    status = case when status = 'sent' then 'viewed'::public.quote_status else status end
  where public_token = p_token and status <> 'draft';
$$;

revoke execute on function public.public_view_quote(text) from public, anon, authenticated;
grant execute on function public.public_view_quote(text) to service_role;

-- Khách bấm "Đồng ý & đặt hàng". Bấm lại lần nữa không tạo thêm đơn. Trả về { status } sau khi xử lý,
-- hoặc { error: 'not_found' | 'expired' | 'closed' }.
create or replace function public.public_accept_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote from public.quotes where public_token = p_token for update;
  if not found or v_quote.status = 'draft' then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_quote.status in ('accepted', 'ordered') then
    return jsonb_build_object('status', v_quote.status);
  end if;
  if v_quote.status = 'expired' or v_quote.valid_until < public.vn_today() then
    update public.quotes set status = 'expired' where id = v_quote.id;
    return jsonb_build_object('error', 'expired');
  end if;
  if v_quote.status not in ('sent', 'viewed') then
    return jsonb_build_object('error', 'closed');
  end if;

  update public.quotes set status = 'accepted', accepted_at = now() where id = v_quote.id;

  -- Tạo đơn ngay; thiếu hàng / phân loại đã xóa thì bỏ qua, báo giá giữ "khách đồng ý" để shop xử lý tay
  begin
    perform public.quote_create_order(v_quote.id, 'cod', null);
  exception when raise_exception then
    null;
  end;

  return jsonb_build_object('status', (select status from public.quotes where id = v_quote.id));
end;
$$;

revoke execute on function public.public_accept_quote(text) from public, anon, authenticated;
grant execute on function public.public_accept_quote(text) to service_role;
