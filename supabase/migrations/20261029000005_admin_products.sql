-- Quản lý sản phẩm ở admin (giai đoạn 3)

-- SKU duy nhất nhưng kiểm tra cuối transaction, để đổi chéo SKU giữa 2 phân loại trong một lần lưu
alter table public.product_variants drop constraint product_variants_sku_key;
alter table public.product_variants add constraint product_variants_sku_key unique (sku) deferrable initially deferred;

-- Số lượng đã bán theo sản phẩm (đơn chưa hủy / chưa trả). security_invoker: vẫn áp RLS của người gọi.
create or replace view public.product_sales with (security_invoker = true) as
select v.product_id, sum(i.qty)::integer as sold
from public.order_items i
join public.orders o on o.id = i.order_id
join public.product_variants v on v.id = i.variant_id
where o.status not in ('cancelled', 'returned')
group by v.product_id;

grant select on public.product_sales to authenticated;

-- Lưu sản phẩm + nhóm phân loại + SKU + ảnh trong một transaction.
-- p: { id?, name, slug, category_id, ..., options: [{ name, values: [{ value, hex }] }],
--      variants: [{ id?, sku, price, stock, is_active, option_values }], images: [{ storage_path }] }
-- Trả về id sản phẩm. Ảnh đầu tiên trong mảng là ảnh bìa.
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
    stock = (x.item ->> 'stock')::integer,
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
