-- 剧本杀排期系统 Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中运行: https://sntrybbtdkifgjfjgmuw.supabase.co

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 卡司表
CREATE TABLE IF NOT EXISTS actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 剧本表
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  min_duration INTEGER DEFAULT 0,
  max_duration INTEGER DEFAULT 0,
  dm_gender TEXT DEFAULT '未指定',
  player_selection_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 剧本玩家角色表
CREATE TABLE IF NOT EXISTS script_player_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  gender TEXT DEFAULT ''
);

-- 剧本卡司角色表
CREATE TABLE IF NOT EXISTS script_actor_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  role_kind TEXT DEFAULT 'dm'
);

-- 剧本演绎板子表
CREATE TABLE IF NOT EXISTS script_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '标准版',
  player_count INTEGER,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 板子包含的演绎角色
CREATE TABLE IF NOT EXISTS script_board_actor_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES script_boards(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  role_kind TEXT DEFAULT 'dm',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, role_name)
);

-- 板子绑定的玩家角色条件
CREATE TABLE IF NOT EXISTS script_board_player_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES script_boards(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, role_name)
);

-- 卡司技能表
CREATE TABLE IF NOT EXISTS actor_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  role_type TEXT DEFAULT 'actor',
  proficiency INTEGER DEFAULT 1,
  UNIQUE(actor_id, script_id, role_name)
);

-- 剧本角色配置表
CREATE TABLE IF NOT EXISTS script_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  required_duration INTEGER,
  start_offset INTEGER DEFAULT 0,
  gender TEXT DEFAULT ''
);

-- 排期表
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  script_board_id UUID REFERENCES script_boards(id) ON DELETE SET NULL,
  actor_role_selection JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_role_selection JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  customer_name TEXT,
  customer_phone TEXT,
  player_count INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 排期卡司分配表
CREATE TABLE IF NOT EXISTS schedule_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL
);

-- 签到记录表
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_avatar TEXT,
  role TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- 评价记录表
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id, guest_name)
);

-- 客户/会员表
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  avatar TEXT,
  membership_level TEXT NOT NULL DEFAULT 'none',
  balance INTEGER DEFAULT 0,
  total_recharged INTEGER DEFAULT 0,
  total_consumed INTEGER DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会员交易记录表
CREATE TABLE IF NOT EXISTS membership_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 客户偏好表
CREATE TABLE IF NOT EXISTS customer_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  preference_level INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, actor_id)
);

-- 矛盾记录表
CREATE TABLE IF NOT EXISTS conflict_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  conflict_description TEXT NOT NULL,
  conflict_date TIMESTAMPTZ NOT NULL,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 提醒表
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  trigger_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 站内通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_end_time ON schedules(end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_room ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_script ON schedules(script_id);
CREATE INDEX IF NOT EXISTS idx_script_boards_script ON script_boards(script_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_script_board_actor_roles_board ON script_board_actor_roles(board_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_script_board_player_roles_board ON script_board_player_roles(board_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_checkins_schedule ON checkins(schedule_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_schedule ON evaluations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_reminders_schedule ON reminders(schedule_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON membership_transactions(customer_id);

-- 启用行级安全（RLS），允许 anon 全部访问（管理后台简化版）
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_player_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_actor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_board_actor_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_board_player_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（简化版，后续加细粒度权限）
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('CREATE POLICY "Allow all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
