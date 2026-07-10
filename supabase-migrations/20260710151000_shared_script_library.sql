ALTER TABLE public.jzg_script_templates
  ADD COLUMN IF NOT EXISTS canonical_key text,
  ADD COLUMN IF NOT EXISTS credits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_record_id text;

UPDATE public.jzg_script_templates
SET canonical_key = lower(regexp_replace(trim(name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
WHERE canonical_key IS NULL OR canonical_key = '';

INSERT INTO public.jzg_script_templates (
  id,
  source_script_id,
  source_tenant_id,
  source_system,
  source_record_id,
  name,
  canonical_key,
  duration_minutes,
  min_duration_hours,
  max_duration_hours,
  dm_gender,
  player_count,
  player_roles,
  actor_roles,
  boards,
  credits,
  usage_count,
  created_by,
  review_status,
  reviewed_at,
  updated_at
)
VALUES (
  '595ecd09-5253-4b17-9cda-32ea45c8818f',
  'd469f40d-7e0f-4552-98ee-cf51314ef27a',
  NULL,
  'lingqi',
  '816137d3-fa3c-4673-a2f7-87d9677e092b',
  '暗夜将至',
  '暗夜将至',
  240,
  4,
  4,
  '未指定',
  6,
  '[{"role_name":"孙侑真","gender":"女","role_kind":"player","tags":[]},{"role_name":"朴贤宇","gender":"男","role_kind":"player","tags":[]},{"role_name":"白瑞妍","gender":"女","role_kind":"player","tags":[]},{"role_name":"车允智","gender":"可男可女","role_kind":"player","tags":["红光"]},{"role_name":"郑宝珠","gender":"女","role_kind":"player","tags":["爹线"]},{"role_name":"金在民","gender":"男","role_kind":"player","tags":[]}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  0,
  '灵契共建',
  'approved',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    canonical_key = EXCLUDED.canonical_key,
    player_count = EXCLUDED.player_count,
    player_roles = EXCLUDED.player_roles,
    source_system = EXCLUDED.source_system,
    source_record_id = EXCLUDED.source_record_id,
    review_status = 'approved',
    updated_at = now();

CREATE UNIQUE INDEX IF NOT EXISTS jzg_script_templates_approved_canonical_key_uidx
  ON public.jzg_script_templates(canonical_key)
  WHERE review_status = 'approved' AND canonical_key IS NOT NULL AND canonical_key <> '';

CREATE INDEX IF NOT EXISTS jzg_script_templates_public_name_idx
  ON public.jzg_script_templates(review_status, name);

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS lingqi_carpool_id text;

CREATE UNIQUE INDEX IF NOT EXISTS schedules_lingqi_carpool_id_uidx
  ON public.schedules(lingqi_carpool_id)
  WHERE lingqi_carpool_id IS NOT NULL;
