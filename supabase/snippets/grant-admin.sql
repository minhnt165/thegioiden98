-- Nâng một tài khoản lên admin. Chạy trong Supabase Dashboard → SQL Editor
-- sau khi đã tạo user ở Authentication → Users. Đổi email bên dưới rồi bấm Run.
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = 'email-cua-ban@example.com'
on conflict (id) do update set role = 'admin';

-- Kiểm tra lại
select u.email, p.role
from public.profiles p join auth.users u on u.id = p.id;
