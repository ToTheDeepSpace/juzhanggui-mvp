-- 后台账号会话版本：停用、改密、重置密码或变更角色后，旧 JWT 立即失效。
-- Additive only: 不修改现有业务数据含义；已有账号统一从版本 1 开始。

ALTER TABLE public.jzg_admin_users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.jzg_admin_users
  DROP CONSTRAINT IF EXISTS jzg_admin_users_session_version_positive;

ALTER TABLE public.jzg_admin_users
  ADD CONSTRAINT jzg_admin_users_session_version_positive
  CHECK (session_version > 0);

CREATE OR REPLACE FUNCTION public.jzg_bump_admin_session_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.session_version := OLD.session_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jzg_admin_users_bump_session_version
  ON public.jzg_admin_users;

CREATE TRIGGER jzg_admin_users_bump_session_version
BEFORE UPDATE OF password_hash, status, role
ON public.jzg_admin_users
FOR EACH ROW
EXECUTE FUNCTION public.jzg_bump_admin_session_version();
