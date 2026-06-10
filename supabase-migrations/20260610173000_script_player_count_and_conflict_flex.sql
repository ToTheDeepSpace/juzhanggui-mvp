ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS player_count integer;

UPDATE public.scripts s
SET player_count = role_counts.role_count
FROM (
  SELECT script_id, count(*)::integer AS role_count
  FROM public.script_player_roles
  GROUP BY script_id
) role_counts
WHERE s.id = role_counts.script_id
  AND s.player_count IS NULL;

UPDATE public.scripts
SET player_count = 6
WHERE player_count IS NULL;

ALTER TABLE public.conflict_records
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN actor_id DROP NOT NULL;
