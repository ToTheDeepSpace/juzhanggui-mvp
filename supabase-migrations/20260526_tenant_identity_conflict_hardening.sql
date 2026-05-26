-- 剧司辰：租户隔离、冲突检测索引补丁。
-- 已在 2026-05-26 通过 Supabase 管理接口应用到生产库。

alter table if exists actors
  add column if not exists tenant_id uuid;

alter table if exists customers
  add column if not exists tenant_id uuid;

update actors
set tenant_id = 'f0d6e011-6e75-4c14-95e9-dc61b26871e3'
where tenant_id is null;

update customers
set tenant_id = 'f0d6e011-6e75-4c14-95e9-dc61b26871e3'
where tenant_id is null;

create index if not exists actors_tenant_id_idx on actors(tenant_id);
create index if not exists customers_tenant_id_idx on customers(tenant_id);
create index if not exists schedule_actors_actor_time_idx on schedule_actors(actor_id, start_time, end_time);
create index if not exists schedules_room_date_time_idx on schedules(room_id, scheduled_date, start_time, end_time);
