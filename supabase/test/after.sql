-- ใช้เฉพาะตอนเทส: ผู้ใช้ในเทส login ด้วย DEV_FAKE_AUTH ไม่ได้อยู่ใน auth.users จริง
alter table public.profiles drop constraint if exists profiles_id_fkey;
