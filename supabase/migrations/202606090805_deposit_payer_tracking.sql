-- 剧司辰：记录定金代付人，支持一人支付全车定金；默认定金改为 100 元

alter table public.checkins
  add column if not exists deposit_payer_name text;

alter table public.jzg_stores
  alter column default_deposit_amount set default 10000;

update public.jzg_stores
set default_deposit_amount = 10000
where default_deposit_amount = 5000;
