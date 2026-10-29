-- Quản lý khách hàng ở admin (giai đoạn 6)
-- Khách được tạo khi lập đơn / báo giá (tìm theo SĐT), hoặc thêm tay ở /admin/khach-hang.
-- Tổng chi tiêu tính như doanh thu: bỏ đơn đã hủy và đơn đổi trả.

create index if not exists quotes_customer_created_idx on public.quotes (customer_id, created_at desc);

create or replace view public.customer_list with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.address,
  c.channel,
  c.note,
  c.created_at,
  coalesce(o.order_count, 0) as order_count,
  coalesce(o.total_spent, 0)::bigint as total_spent,
  o.last_order_at,
  coalesce(q.quote_count, 0) as quote_count,
  coalesce(q.open_quote_count, 0) as open_quote_count,
  lower(extensions.unaccent('extensions.unaccent'::regdictionary, concat_ws(' ',
    c.name, c.phone, regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), c.address
  ))) as search
from public.customers c
left join lateral (
  select
    count(*) filter (where status not in ('cancelled', 'returned'))::integer as order_count,
    sum(total) filter (where status not in ('cancelled', 'returned')) as total_spent,
    max(created_at) as last_order_at
  from public.orders
  where customer_id = c.id
) o on true
left join lateral (
  select
    count(*)::integer as quote_count,
    count(*) filter (
      where status in ('sent', 'viewed', 'accepted') and (status = 'accepted' or valid_until >= public.vn_today())
    )::integer as open_quote_count
  from public.quotes
  where customer_id = c.id
) q on true;

grant select on public.customer_list to authenticated;
