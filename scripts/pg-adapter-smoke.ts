import { randomUUID } from 'crypto';
import { createTencentPgClient, tencentPgPool } from '../api/tencentPgSupabase';

const supabase = createTencentPgClient();
const tenantId = process.env.PG_SMOKE_TENANT_ID || process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
const marker = `pg-smoke-${Date.now()}-${randomUUID().slice(0, 8)}`;

type Step = {
  name: string;
  run: () => Promise<void>;
};

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function checked<T>(label: string, operation: PromiseLike<{ data: T; error: any; count?: number | null }>) {
  const result = await operation;
  if (result.error) throw new Error(`${label}: ${result.error.message || String(result.error)}`);
  return result;
}

async function tableHasColumn(tableName: string, columnName: string) {
  const result = await tencentPgPool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [tableName, columnName],
  );
  return result.rowCount > 0;
}

async function cleanup() {
  await tencentPgPool.query('DELETE FROM evaluations WHERE guest_name = $1', [marker]);
  await tencentPgPool.query('DELETE FROM checkins WHERE guest_name = $1', [marker]);
  await tencentPgPool.query('DELETE FROM notifications WHERE title = $1', [marker]);
  await tencentPgPool.query('DELETE FROM lc_profiles WHERE phone = $1', [marker]);
}

const steps: Step[] = [
  {
    name: 'count/head 查询',
    run: async () => {
      const result = await checked('notifications count', supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId));
      assertOk(typeof result.count === 'number', 'count/head 没有返回数字 count');
    },
  },
  {
    name: 'insert/select/delete 基础写读删',
    run: async () => {
      const inserted = await checked<any>('notification insert', supabase
        .from('notifications')
        .insert({ tenant_id: tenantId, title: marker, message: 'smoke test', type: 'system', is_read: 0 })
        .select()
        .single());
      assertOk(inserted.data?.id, 'insert 没有返回 id');

      const selected = await checked<any>('notification select', supabase
        .from('notifications')
        .select('*')
        .eq('id', inserted.data.id)
        .maybeSingle());
      assertOk(selected.data?.title === marker, 'select 没有读回刚插入的数据');

      await checked('notification delete', supabase
        .from('notifications')
        .delete()
        .eq('id', inserted.data.id));
    },
  },
  {
    name: 'text[] 数组字段写入',
    run: async () => {
      const hasIdentityRoles = await tableHasColumn('lc_profiles', 'identity_roles');
      assertOk(hasIdentityRoles, 'lc_profiles.identity_roles 字段不存在');
      const inserted = await checked<any>('lc_profiles insert array', supabase
        .from('lc_profiles')
        .insert({ tenant_id: tenantId, phone: marker, display_name: marker, role_type: 'player', role: 'player', identity_roles: ['player', 'dm'] })
        .select('id, identity_roles')
        .single());
      assertOk(Array.isArray(inserted.data?.identity_roles), 'identity_roles 没有作为数组读回');
      assertOk(inserted.data.identity_roles.includes('dm'), 'identity_roles 数组内容不正确');
    },
  },
  {
    name: 'relation select 与 post filter',
    run: async () => {
      const result = await checked<any[]>('schedule relation select', supabase
        .from('schedules')
        .select('id, tenant_id, scripts(name), rooms(name)')
        .eq('tenant_id', tenantId)
        .limit(1));
      assertOk(Array.isArray(result.data), 'relation select 没有返回数组');
    },
  },
  {
    name: 'in/or/not 过滤',
    run: async () => {
      const result = await checked<any[]>('schedule filters', supabase
        .from('schedules')
        .select('id,status')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'scheduled', 'completed', 'confirmed', 'ongoing'])
        .not('id', 'is', null)
        .or('status.eq.pending,status.eq.scheduled')
        .limit(5));
      assertOk(Array.isArray(result.data), '过滤查询没有返回数组');
    },
  },
  {
    name: 'upsert onConflict',
    run: async () => {
      const inserted = await checked<any>('notification upsert insert', supabase
        .from('notifications')
        .insert({ tenant_id: tenantId, title: marker, message: 'before upsert', type: 'system', is_read: 0 })
        .select()
        .single());
      const upserted = await checked<any>('notification upsert update', supabase
        .from('notifications')
        .upsert({ id: inserted.data.id, tenant_id: tenantId, title: marker, message: 'after upsert', type: 'system', is_read: 1 }, { onConflict: 'id' })
        .select()
        .single());
      assertOk(upserted.data?.message === 'after upsert', 'upsert 没有更新现有行');
    },
  },
];

async function main() {
  if (!process.env.DATABASE_URL && !process.env.PGHOST) throw new Error('缺少 DATABASE_URL 或 PGHOST，无法运行 PG 适配层 smoke test');
  await cleanup();
  try {
    for (const step of steps) {
      await step.run();
      console.log(`PASS ${step.name}`);
    }
  } finally {
    await cleanup();
    await tencentPgPool.end();
  }
}

main().catch(async error => {
  console.error(`FAIL ${error?.message || error}`);
  try { await cleanup(); } catch {}
  await tencentPgPool.end();
  process.exit(1);
});
