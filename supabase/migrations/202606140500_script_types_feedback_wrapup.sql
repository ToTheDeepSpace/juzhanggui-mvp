alter table if exists public.scripts
  add column if not exists script_type text,
  add column if not exists distribution_type text;

alter table if exists public.schedules
  add column if not exists actual_left_at timestamptz,
  add column if not exists props_checked boolean not null default false,
  add column if not exists costumes_checked boolean not null default false,
  add column if not exists script_cards_checked boolean not null default false,
  add column if not exists review_requested boolean not null default false,
  add column if not exists debrief_done boolean not null default false;

create table if not exists public.jzg_positive_feedbacks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  platform text not null,
  target_name text not null,
  content text,
  screenshot_url text,
  feedback_at timestamptz not null default now(),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jzg_positive_feedbacks_tenant_schedule_idx
  on public.jzg_positive_feedbacks(tenant_id, schedule_id, feedback_at desc);

create index if not exists jzg_positive_feedbacks_target_idx
  on public.jzg_positive_feedbacks(tenant_id, target_name);
