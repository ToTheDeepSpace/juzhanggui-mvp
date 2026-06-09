ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE conflict_records ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS identity_roles text[] NOT NULL DEFAULT '{}'::text[];

UPDATE notifications n
SET tenant_id = s.tenant_id
FROM schedules s
WHERE n.tenant_id IS NULL AND n.schedule_id = s.id;

UPDATE conflict_records c
SET tenant_id = s.tenant_id
FROM schedules s
WHERE c.tenant_id IS NULL AND c.schedule_id = s.id;

UPDATE notifications
SET tenant_id = COALESCE(tenant_id, 'f0d6e011-6e75-4c14-95e9-dc61b26871e3'::uuid),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE tenant_id IS NULL OR updated_at IS NULL;

UPDATE conflict_records
SET tenant_id = COALESCE(tenant_id, 'f0d6e011-6e75-4c14-95e9-dc61b26871e3'::uuid)
WHERE tenant_id IS NULL;

UPDATE lc_profiles
SET identity_roles = COALESCE(
  NULLIF(identity_roles, '{}'::text[]),
  ARRAY[COALESCE(NULLIF(role_type, ''), NULLIF(role, ''), 'player')]
)
WHERE identity_roles = '{}'::text[];

CREATE INDEX IF NOT EXISTS notifications_tenant_idx ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS conflict_records_tenant_idx ON conflict_records(tenant_id);
CREATE INDEX IF NOT EXISTS lc_profiles_identity_roles_gin_idx ON lc_profiles USING gin(identity_roles);
