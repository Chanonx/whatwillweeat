-- ============================================================
-- WhatWillWeEat — Database schema
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ============================================================

create extension if not exists pgcrypto;

-- โปรไฟล์ผู้ใช้ (สร้างจากข้อมูล Google ตอน login) ----------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- กลุ่ม -------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,          -- อยู่ในลิงก์เชิญ /join/<invite_code>
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- สัญญาณ realtime + ตัวกันกดพร้อมกัน ----------------------------------
-- version เพิ่มทุกครั้งที่กลุ่มมีการเปลี่ยนแปลง
-- 1) optimistic locking: แก้ได้ก็ต่อเมื่อ version ยังเท่าเดิม
-- 2) realtime: ทุกจอฟังแถวนี้ พอเปลี่ยน → โหลดข้อมูลใหม่
-- แยกตารางออกมาเพื่อให้เปิดอ่านได้โดยไม่เผยข้อมูลอื่น (เช่น invite_code)
create table if not exists public.group_signals (
  group_id uuid primary key references public.groups(id) on delete cascade,
  version  integer not null default 0
);

-- มื้ออาหาร (1 กลุ่มมีมื้อที่ยังไม่จบได้ทีละ 1 มื้อ) --------------------
create table if not exists public.meals (
  id                   uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.groups(id) on delete cascade,
  status               text not null default 'adding'
                         check (status in ('adding', 'bidding', 'done', 'cancelled')),
  created_by           uuid not null references public.profiles(id),
  winner_restaurant_id uuid,
  was_tie              boolean not null default false,
  created_at           timestamptz not null default now(),
  closed_at            timestamptz
);
create unique index if not exists one_open_meal_per_group
  on public.meals(group_id) where status in ('adding', 'bidding');

create table if not exists public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 50),
  name_key   text not null,                  -- ชื่อแบบ normalize กันร้านซ้ำ
  added_by   uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (meal_id, name_key)
);

-- การบิด (ปิดซองจนกว่าจะเปิดผล) ---------------------------------------
create table if not exists public.bids (
  id            uuid primary key default gen_random_uuid(),
  meal_id       uuid not null references public.meals(id) on delete cascade,
  user_id       uuid not null references public.profiles(id),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  amount        integer not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  unique (meal_id, user_id)
);

-- สมุดบัญชีเหรียญ (ledger) ---------------------------------------------
-- ไม่เก็บ "ยอดคงเหลือ" ตรง ๆ แต่เก็บทุกการเคลื่อนไหว → ยอด = ผลรวม delta
-- ตรวจย้อนหลังได้ว่าเหรียญมา/ไปเพราะอะไร (หลักเดียวกับบัญชีธนาคาร)
create table if not exists public.coin_ledger (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  meal_id    uuid references public.meals(id) on delete set null,
  delta      integer not null,
  reason     text not null check (reason in ('join', 'meal_bonus', 'win')),
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_group_user_idx on public.coin_ledger(group_id, user_id);

-- ============================================================
-- Security (Row Level Security)
-- * ทุกการอ่าน/เขียนข้อมูลจริงผ่าน API ของเรา (server ใช้ secret key)
-- * browser อ่านตรงได้แค่ group_signals (มีแค่ตัวเลข version) เพื่อฟัง realtime
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_signals enable row level security;
alter table public.meals         enable row level security;
alter table public.restaurants   enable row level security;
alter table public.bids          enable row level security;
alter table public.coin_ledger   enable row level security;

drop policy if exists "signals are readable" on public.group_signals;
create policy "signals are readable" on public.group_signals
  for select to anon, authenticated using (true);

-- Realtime ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_signals'
     ) then
    alter publication supabase_realtime add table public.group_signals;
  end if;
end $$;
