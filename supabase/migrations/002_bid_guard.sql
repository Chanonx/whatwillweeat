-- ============================================================
-- 002: กันบิดหลุดเข้ามาหลังเปิดผล (bid vs reveal race)
-- วิธีใช้กับ project ที่ deploy แล้ว: Supabase → SQL Editor → วางไฟล์นี้ → Run (รันซ้ำได้)
--
-- ปัญหา: ถ้ามีคนบิดตรงจังหวะที่เจ้าของกดเปิดผล บิดนั้นอาจถูกบันทึกแต่ไม่ถูกนับ
-- แก้:   ให้ database เช็กเองทุกครั้งที่เขียน bids ว่ามื้อยังเป็น 'bidding' อยู่
--        + ล็อกแถวมื้อแบบ FOR SHARE ระหว่างเช็ก
--        → ถ้าเปิดผลก่อน: บิดถูกปฏิเสธ
--        → ถ้าบิดก่อน: การปิดมื้อต้องรอบิดนั้นบันทึกเสร็จ แล้วจึงอ่านบิดไปคำนวณ (บิดถูกนับ)
-- ============================================================

create or replace function public.ensure_meal_open_for_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meal_status text;
begin
  select status into meal_status
  from public.meals
  where id = new.meal_id
  for share;

  if meal_status is distinct from 'bidding' then
    raise exception 'meal_not_bidding' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bids_require_bidding on public.bids;
create trigger bids_require_bidding
  before insert or update on public.bids
  for each row execute function public.ensure_meal_open_for_bid();
