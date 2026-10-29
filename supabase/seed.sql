-- Dữ liệu mẫu theo mockup. Chạy được nhiều lần trên DB trống (sau `supabase db reset`).
-- Mã đơn sinh từ #1040, mã báo giá từ BG-0009.

-- ============================================================
-- Hàm tạm cho seed
-- ============================================================
create function pg_temp.add_option(p_product_slug text, p_name text, p_sort int, p_values text[], p_hexes text[] default null)
returns void language plpgsql as $$
declare
  v_option_id uuid;
begin
  insert into public.product_options (product_id, name, sort_order)
  select id, p_name, p_sort from public.products where slug = p_product_slug
  returning id into v_option_id;

  insert into public.product_option_values (option_id, value, hex, sort_order)
  select v_option_id, v.value, p_hexes[v.ord], v.ord
  from unnest(p_values) with ordinality as v(value, ord);
end;
$$;

create function pg_temp.add_variant(p_product_slug text, p_sku text, p_price bigint, p_stock int, p_options jsonb default '{}'::jsonb, p_sort int default 0)
returns void language sql as $$
  insert into public.product_variants (product_id, sku, price, stock, option_values, sort_order)
  select id, p_sku, p_price, p_stock, p_options, p_sort from public.products where slug = p_product_slug;
$$;

-- "Kem lanh · Nhỏ" theo thứ tự nhóm phân loại
create function pg_temp.variant_label(p_variant_id uuid)
returns text language sql as $$
  select string_agg(e.value #>> '{}', ' · ' order by o.sort_order)
  from public.product_variants v
  cross join lateral jsonb_each(v.option_values) e
  join public.product_options o on o.product_id = v.product_id and o.name = e.key
  where v.id = p_variant_id;
$$;

create function pg_temp.add_order_item(p_order_id uuid, p_sku text, p_qty int)
returns void language sql as $$
  insert into public.order_items (order_id, variant_id, name_snapshot, variant_snapshot, unit_price, qty)
  select p_order_id, v.id, p.name, pg_temp.variant_label(v.id), v.price, p_qty
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.sku = p_sku;
$$;

create function pg_temp.add_quote_item(p_quote_id uuid, p_sku text, p_qty int, p_sort int)
returns void language sql as $$
  insert into public.quote_items (quote_id, variant_id, name_snapshot, variant_snapshot, unit_price, qty, sort_order)
  select p_quote_id, v.id, p.name, pg_temp.variant_label(v.id), v.price, p_qty, p_sort
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.sku = p_sku;
$$;

-- ============================================================
-- Cài đặt
-- ============================================================
insert into public.settings (key, value, is_public) values
  ('shop_name',      '"Thế Giới Đèn 98"', true),
  ('shop_address',   '"An Khánh, Hà Nội"', true),
  ('opening_hours',  '"9h–17h"', true),
  -- Điền trong /admin/cai-dat. Để trống thì cửa hàng ẩn nút tương ứng.
  ('zalo_phone',     '""', true),
  ('messenger_url',  '""', true),
  ('instagram_url',  '""', true),
  ('quote_default_terms', to_jsonb(E'• Báo giá có hiệu lực đến ngày ghi trên báo giá.\n• Hàng có sẵn: thanh toán khi nhận hàng (COD) hoặc chuyển khoản.\n• Hàng đặt trước: đặt cọc 30%, giao trong 2–3 tuần.\n• Đổi trả trong 7 ngày nếu lỗi do sản xuất.'::text), false),
  ('quote_validity_days', '7', false),
  ('low_stock_threshold', '3', false);

-- ============================================================
-- Danh mục
-- ============================================================
insert into public.categories (name, slug, sort_order) values
  ('Đèn', 'den', 1),
  ('Ghế & Bàn', 'ghe-ban', 2),
  ('Đồ decor', 'do-decor', 3);

-- Cột description có từ migration 20261029000004
update public.categories c set description = v.description
from (values
  ('den', 'Đèn bàn, đèn sàn, đèn thả và đèn tường. Mỗi mẫu đều ghi rõ kích thước, chất liệu và loại bóng.'),
  ('ghe-ban', 'Ghế thư giãn, bàn trà, bàn cà phê từ gỗ tự nhiên — chắc tay, dễ phối.'),
  ('do-decor', 'Bình gốm, đồ trang trí nhỏ cho kệ sách, bàn trà và góc đầu giường.')
) as v(slug, description)
where c.slug = v.slug;

insert into public.categories (name, slug, parent_id, sort_order)
select v.name, v.slug, (select id from public.categories where slug = 'den'), v.sort_order
from (values
  ('Đèn bàn', 'den-ban', 1),
  ('Đèn sàn', 'den-san', 2),
  ('Đèn thả', 'den-tha', 3),
  ('Đèn tường', 'den-tuong', 4)
) as v(name, slug, sort_order);

-- ============================================================
-- Sản phẩm
-- ============================================================
insert into public.products (
  name, slug, category_id, description, material, dimensions, bulb, extra_specs, care_instructions,
  base_price, compare_at_price, status, is_featured, badge, material_tags, color_tags, spaces, seo_description
)
select
  p.name, p.slug, c.id, p.description, p.material, p.dimensions, p.bulb, p.extra_specs::jsonb, p.care,
  p.base_price, p.compare_at_price, p.status::public.product_status, p.is_featured, p.badge::public.product_badge,
  p.material_tags, p.color_tags, p.spaces, p.seo
from (values
  ('Đèn bàn Mộc', 'den-ban-moc', 'den-ban',
   '<p>Được tiện từ một khối gỗ sồi, mỗi thân đèn mang vân gỗ riêng — không chiếc nào giống chiếc nào.</p><p>Chao đèn vải lanh dệt thưa cho ánh sáng mềm, hợp góc đọc sách, đầu giường hoặc bàn làm việc.</p>',
   'Gỗ sồi · vải lanh', 'Ø 28 × cao 38 cm', 'E27 · tối đa 40 W · không kèm bóng',
   '[{"label":"Dây & công tắc","value":"Dây vải 1,8 m · công tắc trên dây"},{"label":"Bảo hành","value":"12 tháng"}]',
   'Lau chao bằng khăn khô; thân gỗ tránh nước và nắng gắt.',
   1890000::bigint, null::bigint, 'active', true, 'bestseller',
   array['go', 'vai-may-tre'], array['den', 'kem', 'xanh-reu'], array['phong-ngu', 'goc-lam-viec'],
   'Đèn bàn Mộc thân gỗ sồi tiện tay, chao vải lanh cho ánh sáng mềm. 4 màu chao, 2 cỡ.'),

  ('Đèn sàn Vòm', 'den-san-vom', 'den-san',
   '<p>Chao vòm thép sơn mờ hắt ánh sáng xuống thấp, đủ cho một góc sofa đọc sách mà không chói mắt.</p>',
   'Thép sơn tĩnh điện', 'Ø 45 × cao 160 cm', 'E27 · tối đa 60 W · không kèm bóng',
   '[{"label":"Dây & công tắc","value":"Dây vải 2 m · công tắc chân"},{"label":"Bảo hành","value":"12 tháng"}]',
   'Lau bằng khăn ẩm vắt kỹ, tránh hóa chất tẩy mạnh.',
   3450000, null, 'active', true, 'new',
   array['kim-loai'], array['den', 'kem'], array['phong-khach'],
   'Đèn sàn Vòm thép sơn tĩnh điện, chao vòm hắt sáng xuống cho góc sofa.'),

  ('Đèn thả Gốm Sứ', 'den-tha-gom-su', 'den-tha',
   '<p>Chao gốm men mờ nặn tay ở Bát Tràng, mép chao để mộc giữ dấu tay người thợ.</p>',
   'Gốm sứ men mờ', 'Ø 30 × cao 26 cm', 'E27 · tối đa 40 W · không kèm bóng',
   '[{"label":"Dây treo","value":"Dây vải 1,5 m, chỉnh được độ cao"},{"label":"Bảo hành","value":"12 tháng"}]',
   'Lau chao bằng khăn mềm; gốm dễ vỡ khi va đập mạnh.',
   2150000, null, 'active', true, 'none',
   array['gom'], array['kem', 'xanh-reu'], array['phong-khach'],
   'Đèn thả chao gốm men mờ nặn tay, hợp bàn ăn và đảo bếp.'),

  ('Ghế thư giãn Nắng', 'ghe-thu-gian-nang', 'ghe-ban',
   '<p>Khung gỗ tần bì uốn cong ôm lưng, đệm vải bố dày tháo rời được để giặt.</p>',
   'Gỗ tần bì · vải bố', '72 × 80 × cao 78 cm', null,
   '[{"label":"Tải trọng","value":"120 kg"},{"label":"Bảo hành","value":"24 tháng khung gỗ"}]',
   'Tháo vỏ đệm giặt tay nước lạnh; gỗ lau khăn khô.',
   5900000, null, 'active', true, 'bestseller',
   array['go', 'vai-may-tre'], array['go', 'kem'], array['phong-khach'],
   'Ghế thư giãn Nắng khung gỗ tần bì, đệm vải bố tháo rời.'),

  ('Đèn bàn Giọt', 'den-ban-giot', 'den-ban',
   '<p>Chao thủy tinh thổi miệng hình giọt nước trên chân đồng thau, bật lên như một đốm nắng chiều.</p>',
   'Thủy tinh thổi · đồng thau', 'Ø 22 × cao 42 cm', 'G9 · LED 4 W · kèm bóng',
   '[{"label":"Dây & công tắc","value":"Dây vải 1,8 m · núm xoay chỉnh độ sáng"},{"label":"Bảo hành","value":"12 tháng"}]',
   'Lau thủy tinh bằng khăn mềm; đồng thau sẽ sẫm màu dần theo thời gian.',
   2400000, null, 'active', false, 'new',
   array['thuy-tinh', 'kim-loai'], array['dong'], array['phong-ngu', 'goc-lam-viec'],
   'Đèn bàn Giọt chao thủy tinh thổi miệng, chân đồng thau, có núm chỉnh sáng.'),

  ('Bình gốm Sa Mạc', 'binh-gom-sa-mac', 'do-decor',
   '<p>Men cát thô màu đất khô, mỗi chiếc loang men một kiểu. Cắm cành khô hay để trống đều đẹp.</p>',
   'Gốm thủ công', 'Nhỏ: Ø 14 × cao 22 cm · Lớn: Ø 18 × cao 32 cm', null,
   '[{"label":"Chứa nước","value":"Có, lòng bình tráng men"}]',
   'Rửa bằng nước, không dùng máy rửa bát.',
   650000, null, 'active', false, 'none',
   array['gom'], array['kem'], array['phong-khach', 'phong-ngu'],
   'Bình gốm Sa Mạc men cát thủ công, 2 cỡ.'),

  ('Bàn cà phê Tròn', 'ban-ca-phe-tron', 'ghe-ban',
   '<p>Mặt gỗ óc chó nguyên tấm, chân bản lớn đặt lệch tâm cho dáng bàn nhẹ hơn.</p>',
   'Gỗ óc chó', 'Ø 80 × cao 42 cm', null,
   '[{"label":"Hoàn thiện","value":"Dầu lau gốc thực vật"},{"label":"Bảo hành","value":"24 tháng"}]',
   'Lót cốc khi để đồ nóng; lau dầu lại mỗi 6 tháng.',
   4200000, null, 'active', false, 'none',
   array['go'], array['go'], array['phong-khach'],
   'Bàn cà phê Tròn mặt gỗ óc chó nguyên tấm.'),

  ('Đèn thả Lưỡi Liềm', 'den-tha-luoi-liem', 'den-tha',
   '<p>Chao kim loại mỏng cong như vầng trăng non, treo thành dãy trên bàn ăn rất đẹp.</p>',
   'Nhôm sơn tĩnh điện', 'Ø 35 × cao 14 cm', 'E27 · tối đa 40 W · không kèm bóng',
   '[{"label":"Dây treo","value":"Dây vải 1,5 m, chỉnh được độ cao"},{"label":"Bảo hành","value":"12 tháng"}]',
   'Lau bằng khăn khô.',
   1650000, 1950000, 'active', false, 'none',
   array['kim-loai'], array['dong', 'den'], array['phong-ngu', 'goc-lam-viec'],
   'Đèn thả Lưỡi Liềm chao nhôm cong, 2 màu đồng và đen.'),

  -- Mẫu cho tab "Nháp" và "Đã ẩn" ở admin
  ('Đèn tường Mây', 'den-tuong-may', 'den-tuong',
   '<p>Chao mây tre đan tay, đang chụp ảnh.</p>',
   'Mây tre đan', 'Ø 30 × sâu 18 cm', 'E27 · tối đa 25 W',
   '[]', null,
   1450000, null, 'draft', false, 'none',
   array['vai-may-tre'], array['go'], array['phong-ngu'],
   null),

  ('Đèn tường Vầng Trăng', 'den-tuong-vang-trang', 'den-tuong',
   '<p>Đĩa đồng hắt sáng ngược lên tường.</p>',
   'Đồng thau', 'Ø 24 × sâu 10 cm', 'G9 · LED 3 W · kèm bóng',
   '[]', null,
   1250000, null, 'hidden', false, 'none',
   array['kim-loai'], array['dong'], array['phong-ngu'],
   null)
) as p(name, slug, category_slug, description, material, dimensions, bulb, extra_specs, care,
       base_price, compare_at_price, status, is_featured, badge, material_tags, color_tags, spaces, seo)
join public.categories c on c.slug = p.category_slug;

-- Ngày tạo lệch nhau để sắp xếp "Mới nhất" có thứ tự rõ ràng
update public.products p set created_at = now() - make_interval(days => v.days_ago), updated_at = now() - make_interval(days => v.days_ago)
from (values
  ('ghe-thu-gian-nang', 60), ('ban-ca-phe-tron', 55), ('binh-gom-sa-mac', 48), ('den-ban-moc', 40),
  ('den-tha-gom-su', 32), ('den-tha-luoi-liem', 25), ('den-san-vom', 12), ('den-ban-giot', 8),
  ('den-tuong-vang-trang', 5), ('den-tuong-may', 1)
) as v(slug, days_ago)
where p.slug = v.slug;

-- ============================================================
-- Phân loại & SKU
-- ============================================================
-- Đèn bàn Mộc: 4 màu chao × 2 cỡ
select pg_temp.add_option('den-ban-moc', 'Màu chao', 1,
  array['Đen than', 'Kem lanh', 'Đất nung', 'Xanh rêu'],
  array['#1B1916', '#E9DEC4', '#B8612A', '#6B7A5E']);
select pg_temp.add_option('den-ban-moc', 'Kích cỡ', 2, array['Nhỏ · cao 38 cm', 'Vừa · cao 48 cm']);
select pg_temp.add_variant('den-ban-moc', 'DBM-DEN-N', 1890000, 6, '{"Màu chao":"Đen than","Kích cỡ":"Nhỏ · cao 38 cm"}', 1);
select pg_temp.add_variant('den-ban-moc', 'DBM-DEN-V', 2290000, 3, '{"Màu chao":"Đen than","Kích cỡ":"Vừa · cao 48 cm"}', 2);
select pg_temp.add_variant('den-ban-moc', 'DBM-KEM-N', 1890000, 8, '{"Màu chao":"Kem lanh","Kích cỡ":"Nhỏ · cao 38 cm"}', 3);
select pg_temp.add_variant('den-ban-moc', 'DBM-KEM-V', 2290000, 2, '{"Màu chao":"Kem lanh","Kích cỡ":"Vừa · cao 48 cm"}', 4);
select pg_temp.add_variant('den-ban-moc', 'DBM-DAT-N', 1890000, 4, '{"Màu chao":"Đất nung","Kích cỡ":"Nhỏ · cao 38 cm"}', 5);
select pg_temp.add_variant('den-ban-moc', 'DBM-DAT-V', 2290000, 0, '{"Màu chao":"Đất nung","Kích cỡ":"Vừa · cao 48 cm"}', 6);
select pg_temp.add_variant('den-ban-moc', 'DBM-REU-N', 1890000, 1, '{"Màu chao":"Xanh rêu","Kích cỡ":"Nhỏ · cao 38 cm"}', 7);
select pg_temp.add_variant('den-ban-moc', 'DBM-REU-V', 2290000, 5, '{"Màu chao":"Xanh rêu","Kích cỡ":"Vừa · cao 48 cm"}', 8);

-- Đèn sàn Vòm: 2 màu
select pg_temp.add_option('den-san-vom', 'Màu', 1, array['Đen than', 'Kem lanh'], array['#1B1916', '#E9DEC4']);
select pg_temp.add_variant('den-san-vom', 'DSV-DEN', 3450000, 5, '{"Màu":"Đen than"}', 1);
select pg_temp.add_variant('den-san-vom', 'DSV-KEM', 3450000, 2, '{"Màu":"Kem lanh"}', 2);

-- Đèn thả Gốm Sứ: 2 màu men
select pg_temp.add_option('den-tha-gom-su', 'Màu men', 1, array['Trắng sữa', 'Xanh rêu'], array['#EFE9DD', '#6B7A5E']);
select pg_temp.add_variant('den-tha-gom-su', 'DTG-TRANG', 2150000, 7, '{"Màu men":"Trắng sữa"}', 1);
select pg_temp.add_variant('den-tha-gom-su', 'DTG-REU', 2150000, 3, '{"Màu men":"Xanh rêu"}', 2);

-- Ghế thư giãn Nắng: 2 màu vải
select pg_temp.add_option('ghe-thu-gian-nang', 'Màu vải', 1, array['Kem', 'Xám đá'], array['#E9DEC4', '#8A8580']);
select pg_temp.add_variant('ghe-thu-gian-nang', 'GTN-KEM', 5900000, 2, '{"Màu vải":"Kem"}', 1);
select pg_temp.add_variant('ghe-thu-gian-nang', 'GTN-XAM', 5900000, 1, '{"Màu vải":"Xám đá"}', 2);

-- Đèn bàn Giọt: không phân loại
select pg_temp.add_variant('den-ban-giot', 'DBG', 2400000, 4);

-- Bình gốm Sa Mạc: 2 cỡ, giá khác nhau
select pg_temp.add_option('binh-gom-sa-mac', 'Kích cỡ', 1, array['Nhỏ', 'Lớn']);
select pg_temp.add_variant('binh-gom-sa-mac', 'BGS-N', 650000, 12, '{"Kích cỡ":"Nhỏ"}', 1);
select pg_temp.add_variant('binh-gom-sa-mac', 'BGS-L', 890000, 5, '{"Kích cỡ":"Lớn"}', 2);

-- Bàn cà phê Tròn: hết hàng
select pg_temp.add_variant('ban-ca-phe-tron', 'BCT', 4200000, 0);

-- Đèn thả Lưỡi Liềm: 2 màu
select pg_temp.add_option('den-tha-luoi-liem', 'Màu', 1, array['Đồng', 'Đen than'], array['#A9763E', '#1B1916']);
select pg_temp.add_variant('den-tha-luoi-liem', 'DTL-DONG', 1650000, 2, '{"Màu":"Đồng"}', 1);
select pg_temp.add_variant('den-tha-luoi-liem', 'DTL-DEN', 1650000, 9, '{"Màu":"Đen than"}', 2);

select pg_temp.add_variant('den-tuong-may', 'DTM', 1450000, 0);
select pg_temp.add_variant('den-tuong-vang-trang', 'DTV', 1250000, 3);

-- ============================================================
-- Khách, đơn hàng, báo giá
-- ============================================================
do $$
declare
  c_ha uuid; c_quan uuid; c_anh uuid; c_long uuid; c_yen uuid;
  o uuid;
  o_from_quote uuid;
  q uuid;
begin
  insert into public.customers (name, phone, address, channel) values
    ('Nguyễn Thu Hà', '0912345678', '18 Trần Đăng Ninh, Cầu Giấy, Hà Nội', 'zalo') returning id into c_ha;
  insert into public.customers (name, phone, address, channel) values
    ('Trần Minh Quân', '0983222114', 'Thôn Yên Lũng, An Khánh, Hoài Đức, Hà Nội', 'messenger') returning id into c_quan;
  insert into public.customers (name, phone, address, channel) values
    ('Lê Phương Anh', '0904556321', '52 Xuân Diệu, Tây Hồ, Hà Nội', 'zalo') returning id into c_anh;
  insert into public.customers (name, phone, address, channel, note) values
    ('Phạm Đức Long', '0936778090', '7 Ngọc Lâm, Long Biên, Hà Nội', 'showroom', 'Khách quen, thích đồ gỗ') returning id into c_long;
  insert into public.customers (name, phone, address, channel) values
    ('Đỗ Hải Yến', '0977101202', '120 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'messenger') returning id into c_yen;

  -- #1040 · đã hủy
  insert into public.orders (customer_id, channel, payment, status, note, created_at)
  values (c_quan, 'messenger', 'cod', 'cancelled', 'Khách đổi ý, chưa giao', now() - interval '7 days 2 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DBG', 1);

  -- #1041 · hoàn tất
  insert into public.orders (customer_id, channel, payment, status, shipping_fee, created_at)
  values (c_ha, 'zalo', 'bank_transfer', 'done', 30000, now() - interval '6 days 5 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DBM-KEM-N', 1);
  perform pg_temp.add_order_item(o, 'BGS-N', 2);

  -- #1042 · hoàn tất, mua tại showroom
  insert into public.orders (customer_id, channel, payment, status, created_at)
  values (c_long, 'showroom', 'cash', 'done', now() - interval '5 days 3 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'GTN-KEM', 1);

  -- #1043 · đang giao
  insert into public.orders (customer_id, channel, payment, status, shipping_fee, created_at)
  values (c_quan, 'messenger', 'cod', 'shipping', 50000, now() - interval '3 days 4 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DSV-DEN', 1);

  -- #1044 · chờ đóng gói
  insert into public.orders (customer_id, channel, payment, status, discount, shipping_fee, created_at)
  values (c_yen, 'messenger', 'bank_transfer', 'packing', 100000, 30000, now() - interval '2 days 6 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DTL-DEN', 2);

  -- #1045 · chờ xác nhận, tạo từ báo giá BG-0011 (gắn bên dưới)
  insert into public.orders (customer_id, channel, payment, status, created_at)
  values (c_anh, 'zalo', 'cod', 'pending', now() - interval '1 day 2 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DTG-TRANG', 1);
  perform pg_temp.add_order_item(o, 'DBG', 1);
  o_from_quote := o;

  -- #1046 · chờ xác nhận
  insert into public.orders (customer_id, channel, payment, status, shipping_fee, created_at)
  values (c_ha, 'zalo', 'cod', 'pending', 30000, now() - interval '3 hours')
  returning id into o;
  perform pg_temp.add_order_item(o, 'DBM-DEN-V', 1);

  -- BG-0009 · hết hạn
  insert into public.quotes (customer_id, status, message, valid_until, sent_at, created_at)
  values (c_long, 'expired', 'Anh Long tham khảo giúp em mẫu bàn mới về nhé.',
          (now() - interval '13 days')::date, now() - interval '20 days', now() - interval '20 days')
  returning id into q;
  perform pg_temp.add_quote_item(q, 'BCT', 1, 1);

  -- BG-0010 · đã gửi, giảm 5%
  insert into public.quotes (customer_id, status, message, discount_percent, valid_until, sent_at, created_at)
  values (c_yen, 'sent', 'Chị Yến ơi, shop gửi báo giá bộ góc đọc sách như chị trao đổi ạ.', 5,
          (now() + interval '6 days')::date, now() - interval '1 day', now() - interval '1 day 1 hour')
  returning id into q;
  perform pg_temp.add_quote_item(q, 'GTN-XAM', 1, 1);
  perform pg_temp.add_quote_item(q, 'DSV-KEM', 1, 2);

  -- BG-0011 · đã thành đơn #1045
  insert into public.quotes (customer_id, status, message, valid_until, view_count, sent_at, viewed_at, accepted_at, order_id, created_at)
  values (c_anh, 'ordered', 'Gửi chị Phương Anh báo giá đèn cho phòng ăn ạ.',
          (now() + interval '4 days')::date, 2, now() - interval '3 days', now() - interval '2 days',
          now() - interval '1 day 2 hours', o_from_quote, now() - interval '3 days 1 hour')
  returning id into q;
  perform pg_temp.add_quote_item(q, 'DTG-TRANG', 1, 1);
  perform pg_temp.add_quote_item(q, 'DBG', 1, 2);
  update public.orders set source_quote_id = q where id = o_from_quote;

  -- BG-0012 · khách đã xem, sắp hết hạn, giảm 10%
  insert into public.quotes (customer_id, status, message, discount_percent, shipping_fee, valid_until, view_count, sent_at, viewed_at, created_at)
  values (c_ha, 'viewed', 'Chị Hà ơi, shop giảm 10% cho đơn từ 2 đèn trở lên ạ.', 10, 30000,
          (now() + interval '2 days')::date, 3, now() - interval '2 days', now() - interval '5 hours', now() - interval '2 days 1 hour')
  returning id into q;
  perform pg_temp.add_quote_item(q, 'DBM-REU-V', 2, 1);
  perform pg_temp.add_quote_item(q, 'BGS-L', 1, 2);

  -- BG-0013 · nháp
  insert into public.quotes (customer_id, status, message, valid_until, created_at)
  values (c_quan, 'draft', 'Anh Quân ơi, 3 đèn thả cho đảo bếp như anh hỏi ạ.',
          (now() + interval '7 days')::date, now() - interval '30 minutes')
  returning id into q;
  perform pg_temp.add_quote_item(q, 'DTL-DONG', 3, 1);
end;
$$;

-- Tính tiền: đơn = tạm tính − giảm + phí giao; báo giá giảm theo % tạm tính (làm tròn đồng)
update public.orders o set
  subtotal = s.subtotal,
  total = s.subtotal - o.discount + o.shipping_fee
from (select order_id, sum(unit_price * qty)::bigint as subtotal from public.order_items group by order_id) s
where s.order_id = o.id;

update public.quotes q set
  subtotal = s.subtotal,
  total = s.subtotal - round(s.subtotal * q.discount_percent / 100)::bigint + q.shipping_fee,
  terms = (select value #>> '{}' from public.settings where key = 'quote_default_terms')
from (select quote_id, sum(unit_price * qty)::bigint as subtotal from public.quote_items group by quote_id) s
where s.quote_id = q.id;

-- Kênh của báo giá theo kênh khách (cột thêm ở migration 007)
update public.quotes q set channel = c.channel from public.customers c where c.id = q.customer_id;
