-- 剧司辰后台邮箱验证码增加“修改/重置密码”用途。
-- Additive-compatible: 只扩展验证码用途约束，不修改业务数据。

ALTER TABLE public.jzg_email_verification_codes
  DROP CONSTRAINT IF EXISTS jzg_email_verification_codes_purpose_check;

ALTER TABLE public.jzg_email_verification_codes
  ADD CONSTRAINT jzg_email_verification_codes_purpose_check
  CHECK (purpose IN ('admin_register', 'admin_login', 'admin_reset_password'));
