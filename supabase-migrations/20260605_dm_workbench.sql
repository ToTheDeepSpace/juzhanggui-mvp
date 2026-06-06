-- DM internal workbench: leave requests and experience notes.
-- Additive only. Existing business data is not modified.

create table if not exists public.jzg_dm_leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default 'f0d6e011-6e75-4c14-95e9-dc61b26871e3',
  actor_id uuid not null references public.actors(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null default '事假',
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jzg_dm_leave_requests_actor_idx
  on public.jzg_dm_leave_requests(actor_id, created_at desc);

create index if not exists jzg_dm_leave_requests_tenant_status_idx
  on public.jzg_dm_leave_requests(tenant_id, status, start_date);

create table if not exists public.jzg_dm_experience_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default 'f0d6e011-6e75-4c14-95e9-dc61b26871e3',
  actor_id uuid not null references public.actors(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  script_id uuid references public.scripts(id) on delete set null,
  script_name text not null,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  visibility text not null default 'internal' check (visibility in ('internal', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jzg_dm_experience_notes_actor_idx
  on public.jzg_dm_experience_notes(actor_id, created_at desc);

create index if not exists jzg_dm_experience_notes_script_idx
  on public.jzg_dm_experience_notes(script_id);

alter table public.jzg_dm_leave_requests enable row level security;
alter table public.jzg_dm_experience_notes enable row level security;

revoke all on table public.jzg_dm_leave_requests from anon, authenticated;
revoke all on table public.jzg_dm_experience_notes from anon, authenticated;
grant all on table public.jzg_dm_leave_requests to service_role;
grant all on table public.jzg_dm_experience_notes to service_role;
