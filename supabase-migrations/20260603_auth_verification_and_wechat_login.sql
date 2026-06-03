-- Phone verification and WeChat login support shared with LingQi.
-- Additive only: no existing business data is deleted or rewritten.

create table if not exists public.lc_auth_verification_codes (
  id uuid primary key default gen_random_uuid(),
  project text not null check (project in ('lingqi', 'juzhanggui')),
  purpose text not null default 'login',
  phone_hash text not null,
  phone_last4 text,
  code_hash text not null,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lc_auth_codes_lookup_idx
  on public.lc_auth_verification_codes (project, purpose, phone_hash, created_at desc);

create index if not exists lc_auth_codes_expires_idx
  on public.lc_auth_verification_codes (expires_at);

create index if not exists lc_auth_codes_consumed_idx
  on public.lc_auth_verification_codes (consumed_at)
  where consumed_at is null;

alter table public.lc_auth_verification_codes enable row level security;

grant all on table public.lc_auth_verification_codes to service_role;

alter table public.players
  add column if not exists auth_provider text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists wechat_openid text,
  add column if not exists wechat_unionid text,
  add column if not exists wechat_nickname text,
  add column if not exists wechat_avatar text,
  add column if not exists wechat_bound_at timestamptz;

create unique index if not exists players_tenant_wechat_openid_unique
  on public.players (tenant_id, wechat_openid)
  where wechat_openid is not null;

create unique index if not exists players_tenant_wechat_unionid_unique
  on public.players (tenant_id, wechat_unionid)
  where wechat_unionid is not null;

do $$
begin
  if to_regclass('public.lc_profiles') is not null then
    alter table public.lc_profiles
      add column if not exists phone_verified_at timestamptz,
      add column if not exists auth_provider text;
  end if;
end $$;
