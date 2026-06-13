-- DM 工作台第二阶段：场控角色、学本任务、考核、执行节点

alter table if exists script_actor_roles
  add column if not exists role_kind text default 'dm';

update script_actor_roles
set role_kind = 'dm'
where role_kind is null or role_kind = '';

create index if not exists actor_skills_actor_script_role_idx
  on actor_skills(actor_id, script_id, role_name);

create table if not exists jzg_actor_learning_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_id uuid not null references actors(id) on delete cascade,
  script_id uuid not null references scripts(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'assigned',
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jzg_actor_learning_tasks_actor_idx
  on jzg_actor_learning_tasks(actor_id, status, due_date);

create table if not exists jzg_actor_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_id uuid not null references actors(id) on delete cascade,
  script_id uuid not null references scripts(id) on delete cascade,
  task_id uuid references jzg_actor_learning_tasks(id) on delete set null,
  assessor_name text,
  result text not null,
  score integer not null default 0,
  note text,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists jzg_actor_assessments_actor_script_idx
  on jzg_actor_assessments(actor_id, script_id, assessed_at desc);

alter table if exists schedule_actors
  add column if not exists dm_confirmed_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists prep_checked_at timestamptz,
  add column if not exists players_ready_at timestamptz,
  add column if not exists started_by_dm_at timestamptz,
  add column if not exists heartbuild_done_at timestamptz,
  add column if not exists current_act integer default 0,
  add column if not exists total_acts integer default 0,
  add column if not exists ended_by_dm_at timestamptz,
  add column if not exists checkout_confirmed_at timestamptz,
  add column if not exists props_checked boolean default false,
  add column if not exists costumes_checked boolean default false,
  add column if not exists script_cards_checked boolean default false,
  add column if not exists review_requested boolean default false,
  add column if not exists debrief_done boolean default false,
  add column if not exists left_at timestamptz;

create table if not exists jzg_schedule_execution_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  schedule_id uuid not null references schedules(id) on delete cascade,
  actor_id uuid references actors(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists jzg_schedule_execution_logs_schedule_idx
  on jzg_schedule_execution_logs(schedule_id, created_at desc);
