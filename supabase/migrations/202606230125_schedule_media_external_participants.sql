-- 房间/卡司照片、剧本第几车、外带 NPC、委托灵契师上车

alter table if exists public.rooms
  add column if not exists photo_url text;

alter table if exists public.actors
  add column if not exists photo_url text;

alter table if exists public.schedules
  add column if not exists store_car_sequence integer;

create table if not exists public.schedule_external_npcs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  role_name text not null,
  provided_by text,
  note text,
  photo_url text,
  count_as_player boolean not null default false,
  count_in_settlement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_external_npcs_schedule_idx
  on public.schedule_external_npcs(schedule_id, created_at);

create table if not exists public.schedule_lingqi_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  lc_profile_id uuid references public.lc_profiles(id) on delete set null,
  display_name text not null,
  avatar_url text,
  role_name text,
  service_type text not null default 'experience_support',
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_lingqi_commissions_schedule_idx
  on public.schedule_lingqi_commissions(schedule_id, status, created_at);

create index if not exists schedule_lingqi_commissions_profile_idx
  on public.schedule_lingqi_commissions(lc_profile_id, status);
