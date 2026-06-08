-- 剧司辰后台邮箱验证码登录/注册。
-- Additive only: 只新增验证码表，不修改业务数据。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.jzg_email_verification_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purpose text NOT NULL CHECK (purpose IN ('admin_register', 'admin_login')),
  email_hash text NOT NULL,
  email_mask text,
  email_domain text,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jzg_email_verification_codes_lookup_idx
  ON public.jzg_email_verification_codes(purpose, email_hash, consumed_at, created_at DESC);

CREATE INDEX IF NOT EXISTS jzg_email_verification_codes_created_idx
  ON public.jzg_email_verification_codes(created_at DESC);

ALTER TABLE public.jzg_email_verification_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jzg_email_verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.jzg_email_verification_codes TO service_role;
