CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.jzg_store_operation_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  actor_admin_user_id uuid,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_label text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jzg_store_operation_logs_tenant_created_idx
  ON public.jzg_store_operation_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS jzg_store_operation_logs_target_idx
  ON public.jzg_store_operation_logs(tenant_id, target_type, target_id, created_at DESC);

ALTER TABLE public.jzg_store_operation_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jzg_store_operation_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.jzg_store_operation_logs TO service_role;
