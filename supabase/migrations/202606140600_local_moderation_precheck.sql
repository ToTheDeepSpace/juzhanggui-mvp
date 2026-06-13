alter table if exists jzg_feedback_messages
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists jzg_dm_experience_notes
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;
