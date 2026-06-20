-- 剧司辰：区分候选玩家角色、实际开本人数，并支持同一剧本多套演绎板子。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS player_selection_rule text;

ALTER TABLE public.jzg_script_templates
  ADD COLUMN IF NOT EXISTS player_count integer,
  ADD COLUMN IF NOT EXISTS player_selection_rule text,
  ADD COLUMN IF NOT EXISTS boards jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.script_boards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '默认板子',
  player_count integer,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.script_board_actor_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id uuid NOT NULL REFERENCES public.script_boards(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  role_kind text NOT NULL DEFAULT 'dm',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, role_name)
);

CREATE INDEX IF NOT EXISTS script_boards_script_id_idx
  ON public.script_boards(script_id, sort_order, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS script_boards_one_default_idx
  ON public.script_boards(script_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS script_board_actor_roles_board_id_idx
  ON public.script_board_actor_roles(board_id, sort_order, created_at);

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS script_board_id uuid REFERENCES public.script_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_role_selection jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.jzg_script_templates
SET player_count = jsonb_array_length(player_roles)
WHERE player_count IS NULL;

INSERT INTO public.script_boards (script_id, name, player_count, is_default, sort_order)
SELECT s.id, '标准版', s.player_count, true, 0
FROM public.scripts s
WHERE NOT EXISTS (
  SELECT 1 FROM public.script_boards b WHERE b.script_id = s.id
);

INSERT INTO public.script_board_actor_roles (board_id, role_name, role_kind, sort_order)
SELECT
  b.id,
  ar.role_name,
  COALESCE(NULLIF(ar.role_kind, ''), 'dm'),
  row_number() OVER (PARTITION BY b.id ORDER BY ar.role_name)::integer
FROM public.script_boards b
JOIN public.script_actor_roles ar ON ar.script_id = b.script_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.script_board_actor_roles br
  WHERE br.board_id = b.id
    AND br.role_name = ar.role_name
);
