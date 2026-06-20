-- 剧司辰：板子匹配加入角色性别版本。
-- 例如玩家角色程聿怀的性别版本影响演绎角色羌青瓷的男女版；同一演绎角色男女版体验不同也要能进板子配置。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.script_board_actor_roles
  ADD COLUMN IF NOT EXISTS gender text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.script_board_player_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id uuid NOT NULL REFERENCES public.script_boards(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  gender text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, role_name)
);

CREATE INDEX IF NOT EXISTS script_board_player_roles_board_id_idx
  ON public.script_board_player_roles(board_id, sort_order, created_at);

ALTER TABLE public.script_board_player_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'script_board_player_roles'
      AND policyname = 'Allow all'
  ) THEN
    CREATE POLICY "Allow all" ON public.script_board_player_roles
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS player_role_selection jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO public.script_board_player_roles (board_id, role_name, gender, sort_order)
SELECT
  b.id,
  pr.role_name,
  COALESCE(pr.gender, ''),
  row_number() OVER (PARTITION BY b.id ORDER BY pr.role_name)::integer
FROM public.script_boards b
JOIN public.script_player_roles pr ON pr.script_id = b.script_id
WHERE b.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.script_board_player_roles bpr
    WHERE bpr.board_id = b.id
      AND bpr.role_name = pr.role_name
  );
