-- Nội dung cửa hàng (giai đoạn 2): mô tả danh mục + cài đặt hiển thị ở trang sản phẩm / trang chủ.

alter table public.categories add column if not exists description text;

update public.categories c set description = v.description
from (values
  ('den', 'Đèn bàn, đèn sàn, đèn thả và đèn tường. Mỗi mẫu đều ghi rõ kích thước, chất liệu và loại bóng.'),
  ('ghe-ban', 'Ghế thư giãn, bàn trà, bàn cà phê từ gỗ tự nhiên — chắc tay, dễ phối.'),
  ('do-decor', 'Bình gốm, đồ trang trí nhỏ cho kệ sách, bàn trà và góc đầu giường.')
) as v(slug, description)
where c.slug = v.slug and c.description is null;

insert into public.settings (key, value, is_public) values
  ('delivery_time', '"1–3 ngày"', true),
  ('preorder_time', '"2–3 tuần"', true),
  ('shipping_notes', '["Đóng gói thùng carton hai lớp, chèn mút chống sốc.", "Giao nội thành Hà Nội: 1–2 ngày. Tỉnh khác: 3–5 ngày.", "Đổi trả trong 7 ngày nếu lỗi do sản xuất."]', true),
  ('about_text', '"Một cửa hàng nhỏ ở An Khánh, chọn từng chiếc đèn, chiếc ghế từ những xưởng thủ công trong nước — đủ đẹp để nhìn cả ngày, đủ bền để dùng nhiều năm."', true)
on conflict (key) do nothing;
