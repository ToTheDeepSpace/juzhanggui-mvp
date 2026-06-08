alter table public.jzg_script_templates
  add column if not exists review_status text not null default 'pending';

alter table public.jzg_script_templates
  add column if not exists reviewed_at timestamptz;

alter table public.jzg_script_templates
  add column if not exists reviewed_by uuid;

alter table public.jzg_script_templates
  add column if not exists reject_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jzg_script_templates_review_status_check'
  ) then
    alter table public.jzg_script_templates
      add constraint jzg_script_templates_review_status_check
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

update public.jzg_script_templates
set review_status = 'approved',
    reviewed_at = coalesce(reviewed_at, now())
where review_status = 'pending'
  and created_at < timestamptz '2026-06-09 03:07:00+08';

create index if not exists jzg_script_templates_review_status_idx
  on public.jzg_script_templates(review_status);
