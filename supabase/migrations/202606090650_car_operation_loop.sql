-- 剧司辰车次经营闭环：定金、结算、锁 DM 权益、店家套餐

alter table public.checkins
  add column if not exists customer_id uuid,
  add column if not exists deposit_status text not null default 'unpaid',
  add column if not exists deposit_amount integer not null default 0,
  add column if not exists deposit_payment_method text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_note text,
  add column if not exists final_amount integer not null default 0,
  add column if not exists final_payment_method text,
  add column if not exists final_paid_at timestamptz,
  add column if not exists settlement_status text not null default 'unsettled',
  add column if not exists settlement_note text;

alter table public.customers
  add column if not exists bonus_balance integer not null default 0,
  add column if not exists lock_dm_credits integer not null default 0,
  add column if not exists total_bonus_granted integer not null default 0,
  add column if not exists total_lock_dm_granted integer not null default 0,
  add column if not exists total_lock_dm_used integer not null default 0;

alter table public.membership_transactions
  add column if not exists balance_delta integer not null default 0,
  add column if not exists bonus_delta integer not null default 0,
  add column if not exists lock_dm_delta integer not null default 0,
  add column if not exists payment_method text,
  add column if not exists package_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.schedules
  add column if not exists lock_reason text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists dm_lock_customer_id uuid,
  add column if not exists requested_dm_actor_id uuid,
  add column if not exists dm_lock_status text not null default 'none',
  add column if not exists dm_lock_credit_transaction_id uuid,
  add column if not exists actual_started_at timestamptz,
  add column if not exists actual_ended_at timestamptz,
  add column if not exists settlement_status text not null default 'unsettled',
  add column if not exists settlement_completed_at timestamptz,
  add column if not exists settlement_note text;

create table if not exists public.jzg_membership_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  recharge_amount integer not null default 0,
  bonus_amount integer not null default 0,
  lock_dm_credits integer not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jzg_membership_packages_tenant_active
  on public.jzg_membership_packages(tenant_id, is_active);

create table if not exists public.jzg_marketing_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  item_type text not null default 'custom',
  price_amount integer not null default 0,
  bonus_amount integer not null default 0,
  lock_dm_credits integer not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jzg_marketing_items_tenant_active
  on public.jzg_marketing_items(tenant_id, is_active);
