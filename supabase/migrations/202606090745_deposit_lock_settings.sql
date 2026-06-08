-- 剧司辰：店家默认定金与结算时定金处理方式

alter table public.jzg_stores
  add column if not exists default_deposit_amount integer not null default 5000;

alter table public.checkins
  add column if not exists deposit_settlement_mode text not null default 'deduct_final';
