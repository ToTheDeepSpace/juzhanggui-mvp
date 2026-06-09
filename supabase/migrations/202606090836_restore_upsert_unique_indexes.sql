create unique index if not exists jzg_script_templates_source_unique
  on public.jzg_script_templates(source_script_id, source_tenant_id);

create unique index if not exists evaluations_schedule_guest_unique
  on public.evaluations(schedule_id, guest_name);
