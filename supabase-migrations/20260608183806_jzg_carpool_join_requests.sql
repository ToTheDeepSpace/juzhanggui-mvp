-- 剧司辰：拼车玩家扫码加入排期申请。
-- Additive only: 新增申请表，不改动既有排期、玩家、签到数据。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.jzg_carpool_join_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  phone_hash text,
  role_name text,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  source text NOT NULL DEFAULT 'qr_join',
  checkin_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jzg_carpool_join_requests_schedule_status_idx
  ON public.jzg_carpool_join_requests(schedule_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS jzg_carpool_join_requests_player_idx
  ON public.jzg_carpool_join_requests(player_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS jzg_carpool_join_requests_active_unique_idx
  ON public.jzg_carpool_join_requests(schedule_id, player_id)
  WHERE status IN ('pending', 'confirmed') AND player_id IS NOT NULL;

ALTER TABLE public.jzg_carpool_join_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jzg_carpool_join_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.jzg_carpool_join_requests TO service_role;
