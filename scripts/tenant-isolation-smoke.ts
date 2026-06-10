import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { tencentPgPool } from '../api/tencentPgSupabase';

const marker = `tenant-isolation-${Date.now()}-${randomUUID().slice(0, 8)}`;
const apiBaseUrl = (process.env.API_BASE_URL || process.env.JUZHANGGUI_SITE_URL || 'https://jusichen.com').replace(/\/$/, '');
const jwtSecret = process.env.JWT_SECRET || '';

type StoreBundle = {
  storeId: string;
  userId: string;
  token: string;
  scriptId: string;
  roomId: string;
  actorId: string;
  customerId: string;
  scheduleId: string;
  checkinId: string;
};

type Step = {
  name: string;
  run: () => Promise<void>;
};

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function queryOne<T = any>(sql: string, params: any[] = []) {
  const result = await tencentPgPool.query(sql, params);
  return result.rows[0] as T;
}

async function api(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  let body: any = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

function expectStatus(label: string, actual: number, allowed: number[]) {
  assertOk(allowed.includes(actual), `${label}: 期望状态 ${allowed.join('/')}，实际 ${actual}`);
}

function tokenFor(bundle: Pick<StoreBundle, 'storeId' | 'userId'>, email: string) {
  return jwt.sign({
    role: 'admin',
    adminRole: 'store_admin',
    adminUserId: bundle.userId,
    email,
    tenantId: bundle.storeId,
    storeId: bundle.storeId,
  }, jwtSecret, { expiresIn: '2h' });
}

async function createStoreBundle(key: 'a' | 'b'): Promise<StoreBundle> {
  const store = await queryOne<{ id: string }>(
    `insert into jzg_stores (name, city, status) values ($1, $2, 'active') returning id`,
    [`${marker}-${key}-store`, '隔离测试'],
  );
  const email = `${marker}-${key}@example.com`;
  const user = await queryOne<{ id: string }>(
    `insert into jzg_admin_users (tenant_id, store_id, email, display_name, role, status, email_verified_at) values ($1, $1, $2, $3, 'store_admin', 'active', now()) returning id`,
    [store.id, email, `${marker}-${key}-admin`],
  );
  const script = await queryOne<{ id: string }>(
    `insert into scripts (tenant_id, name, duration_minutes, min_duration_hours, max_duration_hours) values ($1, $2, 240, 4, 4) returning id`,
    [store.id, `${marker}-${key}-script`],
  );
  await tencentPgPool.query(`insert into script_player_roles (script_id, role_name, gender) values ($1, '角色一', '不限')`, [script.id]);
  await tencentPgPool.query(`insert into script_actor_roles (script_id, role_name, gender) values ($1, 'NPC一', '不限')`, [script.id]);
  const room = await queryOne<{ id: string }>(
    `insert into rooms (tenant_id, name, capacity, status) values ($1, $2, 6, 'available') returning id`,
    [store.id, `${marker}-${key}-room`],
  );
  const actor = await queryOne<{ id: string }>(
    `insert into actors (tenant_id, name, gender) values ($1, $2, '不限') returning id`,
    [store.id, `${marker}-${key}-actor`],
  );
  const customer = await queryOne<{ id: string }>(
    `insert into customers (tenant_id, name, phone, lock_dm_credits) values ($1, $2, $3, 1) returning id`,
    [store.id, `${marker}-${key}-customer`, `199${Math.floor(Math.random() * 90000000 + 10000000)}`],
  );
  const schedule = await queryOne<{ id: string }>(
    `insert into schedules (tenant_id, script_id, room_id, scheduled_date, start_time, end_time, status, customer_name, player_count) values ($1, $2, $3, current_date, '10:00', '14:00', 'scheduled', $4, 6) returning id`,
    [store.id, script.id, room.id, `${marker}-${key}-schedule`],
  );
  const checkin = await queryOne<{ id: string }>(
    `insert into checkins (schedule_id, guest_name, role, deposit_status, customer_id) values ($1, $2, '角色一', 'paid', $3) returning id`,
    [schedule.id, `${marker}-${key}-guest`, customer.id],
  );
  await tencentPgPool.query(`insert into evaluations (schedule_id, guest_name, rating, comment) values ($1, $2, 5, $3)`, [schedule.id, `${marker}-${key}-guest`, `${marker}-${key}-eval`]);
  const bundle = { storeId: store.id, userId: user.id };
  return {
    ...bundle,
    token: tokenFor(bundle, email),
    scriptId: script.id,
    roomId: room.id,
    actorId: actor.id,
    customerId: customer.id,
    scheduleId: schedule.id,
    checkinId: checkin.id,
  };
}

async function cleanup() {
  await tencentPgPool.query(
    `delete from jzg_stores where name like $1`,
    [`${marker}%`],
  ).catch(() => {});
}

let a: StoreBundle;
let b: StoreBundle;
let poolClosed = false;

async function closePool() {
  if (poolClosed) return;
  poolClosed = true;
  await tencentPgPool.end();
}

const steps: Step[] = [
  {
    name: 'A 店列表接口不出现 B 店数据',
    run: async () => {
      for (const path of ['/stores/current', '/scripts', '/rooms', '/actors', '/customers', '/schedules', '/operation-logs']) {
        const { response, body } = await api(`/api${path}`, a.token);
        expectStatus(path, response.status, [200]);
        const text = JSON.stringify(body);
        assertOk(!text.includes(b.storeId), `${path}: 返回了 B 店 storeId`);
        assertOk(!text.includes(b.scriptId), `${path}: 返回了 B 店 scriptId`);
        assertOk(!text.includes(b.roomId), `${path}: 返回了 B 店 roomId`);
        assertOk(!text.includes(b.actorId), `${path}: 返回了 B 店 actorId`);
        assertOk(!text.includes(b.customerId), `${path}: 返回了 B 店 customerId`);
        assertOk(!text.includes(b.scheduleId), `${path}: 返回了 B 店 scheduleId`);
      }
    },
  },
  {
    name: 'A 店不能读取 B 店排期详情/签到/评价',
    run: async () => {
      for (const path of [`/schedules/${b.scheduleId}`, `/schedules/${b.scheduleId}/checkins`, `/schedules/${b.scheduleId}/evaluation`]) {
        const { response } = await api(`/api${path}`, a.token);
        expectStatus(path, response.status, [404]);
      }
    },
  },
  {
    name: 'A 店不能读取 B 店剧本评价统计',
    run: async () => {
      for (const path of [`/scripts/${b.scriptId}/evaluations`, `/scripts/${b.scriptId}/evaluation-stats`]) {
        const { response } = await api(`/api${path}`, a.token);
        expectStatus(path, response.status, [404]);
      }
    },
  },
  {
    name: 'A 店不能修改/删除 B 店排期',
    run: async () => {
      const update = await api(`/api/schedules/${b.scheduleId}`, a.token, { method: 'PUT', body: JSON.stringify({ customerName: `${marker}-hack` }) });
      expectStatus('update B schedule', update.response.status, [404]);
      const remove = await api(`/api/schedules/${b.scheduleId}`, a.token, { method: 'DELETE' });
      expectStatus('delete B schedule', remove.response.status, [404]);
    },
  },
  {
    name: 'A 店创建排期不能引用 B 店剧本/房间/卡司',
    run: async () => {
      const withBScript = await api('/api/schedules', a.token, { method: 'POST', body: JSON.stringify({ scriptId: b.scriptId, roomId: a.roomId, date: '2030-01-01', timeStart: '10:00', timeEnd: '14:00' }) });
      expectStatus('create with B script', withBScript.response.status, [404]);
      const withBRoom = await api('/api/schedules', a.token, { method: 'POST', body: JSON.stringify({ scriptId: a.scriptId, roomId: b.roomId, date: '2030-01-01', timeStart: '10:00', timeEnd: '14:00' }) });
      expectStatus('create with B room', withBRoom.response.status, [404]);
      const withBActor = await api('/api/schedules', a.token, { method: 'POST', body: JSON.stringify({ scriptId: a.scriptId, roomId: a.roomId, date: '2030-01-01', timeStart: '10:00', timeEnd: '14:00', actors: [{ actorId: b.actorId, roleName: 'NPC一', startTime: '10:00', endTime: '14:00' }] }) });
      expectStatus('create with B actor', withBActor.response.status, [404]);
    },
  },
  {
    name: 'A 店不能把 B 店客户绑定到 A 店签到财务',
    run: async () => {
      const result = await api(`/api/schedules/${a.scheduleId}/checkins/${a.checkinId}/finance`, a.token, { method: 'PUT', body: JSON.stringify({ customerId: b.customerId, depositStatus: 'paid' }) });
      expectStatus('bind B customer', result.response.status, [404]);
    },
  },
  {
    name: 'A 店不能用 B 店房间确认 A 店排期',
    run: async () => {
      const result = await api(`/api/schedules/${a.scheduleId}/confirm`, a.token, { method: 'PUT', body: JSON.stringify({ roomId: b.roomId }) });
      expectStatus('confirm with B room', result.response.status, [404]);
    },
  },
  {
    name: 'A 店不能用 B 店卡司修改 A 店排期',
    run: async () => {
      const result = await api(`/api/schedules/${a.scheduleId}`, a.token, { method: 'PUT', body: JSON.stringify({ actors: [{ actorId: b.actorId, roleName: 'NPC一', startTime: '10:00', endTime: '14:00' }] }) });
      expectStatus('update actors with B actor', result.response.status, [404]);
    },
  },
  {
    name: 'A 店可正常访问自己的核心数据',
    run: async () => {
      for (const path of [`/schedules/${a.scheduleId}`, `/schedules/${a.scheduleId}/checkins`, `/schedules/${a.scheduleId}/evaluation`, `/scripts/${a.scriptId}/evaluation-stats`]) {
        const { response } = await api(`/api${path}`, a.token);
        expectStatus(path, response.status, [200]);
      }
    },
  },
];

async function main() {
  if (!process.env.DATABASE_URL && !process.env.PGHOST) throw new Error('缺少 DATABASE_URL 或 PGHOST');
  if (!jwtSecret) throw new Error('缺少 JWT_SECRET');
  await cleanup();
  try {
    a = await createStoreBundle('a');
    b = await createStoreBundle('b');
    for (const step of steps) {
      await step.run();
      console.log(`PASS ${step.name}`);
    }
  } finally {
    await cleanup();
    await closePool();
  }
}

main().catch(async error => {
  console.error(`FAIL ${error?.message || error}`);
  try { await cleanup(); } catch {}
  await closePool();
  process.exit(1);
});
