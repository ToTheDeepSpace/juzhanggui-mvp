-- 剧司辰：多店家入口 + 公共剧本模版。
-- 设计目标：先让后台能登记多个店家，并把任一店家的剧本沉淀为全站可导入模版。

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS jzg_stores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text,
  address text,
  contact text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO jzg_stores (id, name, city, status)
VALUES ('f0d6e011-6e75-4c14-95e9-dc61b26871e3', '默认店家', '未设置', 'active')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS jzg_stores_status_idx ON jzg_stores(status, created_at DESC);

CREATE TABLE IF NOT EXISTS jzg_script_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_script_id uuid,
  source_tenant_id uuid,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 240,
  min_duration_hours numeric NOT NULL DEFAULT 4,
  max_duration_hours numeric NOT NULL DEFAULT 4,
  dm_gender text DEFAULT '未指定',
  player_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_script_id, source_tenant_id)
);

CREATE INDEX IF NOT EXISTS jzg_script_templates_name_idx ON jzg_script_templates(name);
CREATE INDEX IF NOT EXISTS jzg_script_templates_usage_idx ON jzg_script_templates(usage_count DESC, created_at DESC);
