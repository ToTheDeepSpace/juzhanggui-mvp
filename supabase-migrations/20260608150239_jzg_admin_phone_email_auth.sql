-- 剧司辰主后台账号：邮箱密码登录、手机号验证码登录、邮箱账号绑定手机。
-- Additive only: 不删除、不覆盖现有排期、店家、玩家或 DM 数据。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.jzg_admin_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL DEFAULT 'f0d6e011-6e75-4c14-95e9-dc61b26871e3',
  store_id uuid REFERENCES public.jzg_stores(id) ON DELETE SET NULL,
  email text,
  phone text,
  display_name text NOT NULL DEFAULT '店家管理员',
  password_hash text,
  role text NOT NULL DEFAULT 'store_admin'
    CHECK (role IN ('super_admin', 'store_admin', 'staff')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  auth_provider text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jzg_admin_users'::regclass
      AND conname = 'jzg_admin_users_role_check'
  ) THEN
    ALTER TABLE public.jzg_admin_users DROP CONSTRAINT jzg_admin_users_role_check;
  END IF;
END $$;

ALTER TABLE public.jzg_admin_users
  ADD CONSTRAINT jzg_admin_users_role_check
  CHECK (role IN ('super_admin', 'store_admin', 'staff'));

DROP INDEX IF EXISTS public.jzg_admin_users_tenant_email_unique;
DROP INDEX IF EXISTS public.jzg_admin_users_tenant_phone_unique;

CREATE UNIQUE INDEX IF NOT EXISTS jzg_admin_users_email_unique
  ON public.jzg_admin_users(lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jzg_admin_users_phone_unique
  ON public.jzg_admin_users(phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS jzg_admin_users_tenant_status_idx
  ON public.jzg_admin_users(tenant_id, status, created_at DESC);

ALTER TABLE public.jzg_admin_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.jzg_admin_users TO service_role;
