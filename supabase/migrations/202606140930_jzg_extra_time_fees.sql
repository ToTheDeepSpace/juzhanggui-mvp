-- 剧司辰：店家级早起费 / 修仙费默认规则。
-- 金额单位沿用系统内的“分”；最终实际收款仍写入 checkins.final_amount。

alter table public.jzg_stores
  add column if not exists early_fee_enabled boolean not null default true,
  add column if not exists early_fee_start_time text not null default '00:00',
  add column if not exists early_fee_end_time text not null default '12:00',
  add column if not exists early_fee_amount_per_hour integer not null default 1000,
  add column if not exists night_fee_enabled boolean not null default true,
  add column if not exists night_fee_start_time text not null default '00:30',
  add column if not exists night_fee_end_time text not null default '06:00',
  add column if not exists night_fee_amount_per_hour integer not null default 1000;

