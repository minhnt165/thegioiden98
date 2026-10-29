-- Bucket ảnh sản phẩm: public nên ai cũng xem ảnh qua URL công khai, chỉ admin được ghi.
-- Không mở SELECT cho anon để người ngoài không liệt kê được toàn bộ file trong bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "Admin xem danh sách ảnh sản phẩm"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));

create policy "Admin tải ảnh sản phẩm lên"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "Admin sửa ảnh sản phẩm"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'products' and (select public.is_admin()))
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "Admin xóa ảnh sản phẩm"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));
