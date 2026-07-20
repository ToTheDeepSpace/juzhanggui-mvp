-- Bind player-facing check-ins and evaluations to authenticated player accounts.
-- Additive migration: existing rows remain; only unambiguous historical matches are annotated.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS player_id uuid;

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS player_id uuid,
  ADD COLUMN IF NOT EXISTS checkin_id uuid;

ALTER TABLE public.membership_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkins_player_id_fkey'
  ) THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evaluations_player_id_fkey'
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evaluations_checkin_id_fkey'
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_checkin_id_fkey
      FOREIGN KEY (checkin_id) REFERENCES public.checkins(id) ON DELETE SET NULL;
  END IF;
END $$;

WITH candidates AS (
  SELECT checkin.id AS checkin_id, min(player.id::text)::uuid AS player_id
  FROM public.checkins AS checkin
  JOIN public.schedules AS schedule ON schedule.id = checkin.schedule_id
  JOIN public.players AS player
    ON player.tenant_id = schedule.tenant_id
   AND player.phone_hash = checkin.guest_phone
  WHERE checkin.player_id IS NULL
    AND checkin.guest_phone IS NOT NULL
  GROUP BY checkin.id
  HAVING count(*) = 1
)
UPDATE public.checkins AS checkin
SET player_id = candidates.player_id
FROM candidates
WHERE checkin.id = candidates.checkin_id;

WITH candidate_rows AS (
  SELECT
    evaluation.id AS evaluation_id,
    checkin.id AS checkin_id,
    checkin.player_id,
    count(*) OVER (PARTITION BY evaluation.id) AS candidate_count
  FROM public.evaluations AS evaluation
  JOIN public.checkins AS checkin
    ON checkin.schedule_id = evaluation.schedule_id
   AND checkin.guest_name = evaluation.guest_name
  WHERE evaluation.checkin_id IS NULL
), candidates AS (
  SELECT evaluation_id, checkin_id, player_id
  FROM candidate_rows
  WHERE candidate_count = 1
)
UPDATE public.evaluations AS evaluation
SET checkin_id = candidates.checkin_id,
    player_id = candidates.player_id
FROM candidates
WHERE evaluation.id = candidates.evaluation_id;

CREATE UNIQUE INDEX IF NOT EXISTS checkins_schedule_role_unique_idx
  ON public.checkins(schedule_id, role)
  WHERE role IS NOT NULL AND btrim(role) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS checkins_schedule_player_unique_idx
  ON public.checkins(schedule_id, player_id)
  WHERE player_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS evaluations_schedule_player_unique_idx
  ON public.evaluations(schedule_id, player_id)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS checkins_player_checked_at_idx
  ON public.checkins(player_id, checked_at DESC)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS evaluations_player_created_at_idx
  ON public.evaluations(player_id, created_at DESC)
  WHERE player_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS membership_transactions_idempotency_unique_idx
  ON public.membership_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
