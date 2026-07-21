import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { tencentPgPool } from '../api/tencentPgSupabase';

const marker = `tenant-isolation-${Date.now()}-${randomUUID().slice(0, 8)}`;
const apiBaseUrl = (process.env.API_BASE_URL || process.env.JUZHANGGUI_SITE_URL || 'https://jusichen.com').replace(/\/$/, '');
const testPassword = `Pwd-${marker}-12345`;

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
  conflictId: string;
  feedbackId: string;
  playerId: string;
  playerToken: string;
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

async function login(email: string) {
  const result = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: testPassword }),
  });
  const body: any = await result.json().catch(() => null);
  assertOk(result.status === 200 && body?.success && body?.data?.token, `登录失败：${email}`);
  return body.data.token as string;
}

async function createStoreBundle(key: 'a' | 'b'): Promise<StoreBundle> {
  const store = await queryOne<{ id: string }>(
    `insert into jzg_stores (name, city, status) values ($1, $2, 'active') returning id`,
    [`${marker}-${key}-store`, '隔离测试'],
  );
  const email = `${marker}-${key}@example.com`;
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const user = await queryOne<{ id: string }>(
    `insert into jzg_admin_users (tenant_id, store_id, email, display_name, password_hash, role, status, email_verified_at) values ($1, $1, $2, $3, $4, 'store_admin', 'active', now()) returning id`,
    [store.id, email, `${marker}-${key}-admin`, passwordHash],
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
    `insert into schedules (tenant_id, script_id, room_id, script_name, room_name, scheduled_date, start_time, end_time, status, player_count) values ($1, $2, $3, $4, $5, current_date, '10:00', '14:00', 'scheduled', 6) returning id`,
    [store.id, script.id, room.id, `${marker}-${key}-script`, `${marker}-${key}-room`],
  );
  const checkin = await queryOne<{ id: string }>(
    `insert into checkins (schedule_id, guest_name, role, deposit_status, customer_id) values ($1, $2, '角色一', 'paid', $3) returning id`,
    [schedule.id, `${marker}-${key}-guest`, customer.id],
  );
  await tencentPgPool.query(`insert into evaluations (schedule_id, guest_name, rating, comment) values ($1, $2, 5, $3)`, [schedule.id, `${marker}-${key}-guest`, `${marker}-${key}-eval`]);
  const conflict = await queryOne<{ id: string }>(
    `insert into conflict_records (tenant_id, schedule_id, customer_id, actor_id, conflict_type, conflict_description, conflict_date, status) values ($1, $2, $3, $4, 'other_conflict', $5, now(), 'pending') returning id`,
    [store.id, schedule.id, customer.id, actor.id, `${marker}-${key}-conflict`],
  );
  const feedback = await queryOne<{ id: string }>(
    `insert into jzg_feedback_messages (tenant_id, admin_user_id, category, title, content, status, priority) values ($1, $2, 'bug', $3, $4, 'open', 'normal') returning id`,
    [store.id, user.id, `${marker}-${key}-feedback`, `${marker}-${key}-feedback-content`],
  );
  await tencentPgPool.query(
    `insert into membership_transactions (customer_id, schedule_id, amount, transaction_type, note, balance_delta, payment_method) values ($1, $2, 1000, 'recharge', $3, 1000, 'cash')`,
    [customer.id, schedule.id, `${marker}-${key}-transaction`],
  );
  const player = await queryOne<{ id: string }>(
    `insert into players (tenant_id, phone_hash, display_name, name_encrypted, auth_provider, phone_verified_at) values ($1, $2, $3, $3, 'phone', now()) returning id`,
    [store.id, `${marker}-${key}-phone-hash`, `${marker}-${key}-player`],
  );
  const token = await login(email);
  const playerToken = jwt.sign(
    { role: 'player', playerId: player.id, tenantId: store.id },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' },
  );
  const bundle = { storeId: store.id, userId: user.id };
  return {
    ...bundle,
    token,
    scriptId: script.id,
    roomId: room.id,
    actorId: actor.id,
    customerId: customer.id,
    scheduleId: schedule.id,
    checkinId: checkin.id,
    conflictId: conflict.id,
    feedbackId: feedback.id,
    playerId: player.id,
    playerToken,
  };
}

async function cleanup() {
  await tencentPgPool.query(
    `delete from jzg_stores where name like $1`,
    [`${marker}%`],
  ).catch(() => {});
  await tencentPgPool.query(
    `delete from players where display_name like $1`,
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
      for (const path of ['/stores', '/scripts', '/rooms', '/actors', '/customers', '/schedules', '/operation-logs', '/feedback', '/conflicts/pending']) {
        const { response, body } = await api(`/api${path}`, a.token);
        expectStatus(path, response.status, [200]);
        const text = JSON.stringify(body);
        assertOk(!text.includes(b.storeId), `${path}: 返回了 B 店 storeId`);
        assertOk(!text.includes(b.scriptId), `${path}: 返回了 B 店 scriptId`);
        assertOk(!text.includes(b.roomId), `${path}: 返回了 B 店 roomId`);
        assertOk(!text.includes(b.actorId), `${path}: 返回了 B 店 actorId`);
        assertOk(!text.includes(b.customerId), `${path}: 返回了 B 店 customerId`);
        assertOk(!text.includes(b.scheduleId), `${path}: 返回了 B 店 scheduleId`);
        assertOk(!text.includes(b.conflictId), `${path}: 返回了 B 店 conflictId`);
        assertOk(!text.includes(b.feedbackId), `${path}: 返回了 B 店 feedbackId`);
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
    name: 'A 店不能处理 B 店矛盾记录',
    run: async () => {
      const result = await api(`/api/conflicts/${b.conflictId}/resolve`, a.token, { method: 'POST', body: JSON.stringify({ resolution: `${marker}-hack`, resolved_by: 'A', status: 'resolved' }) });
      expectStatus('resolve B conflict', result.response.status, [404]);
      const createWithBRefs = await api('/api/conflicts', a.token, { method: 'POST', body: JSON.stringify({ scheduleId: b.scheduleId, customerId: b.customerId, actorId: b.actorId, conflictType: 'other_conflict', conflictDescription: `${marker}-hack`, conflictDate: new Date().toISOString() }) });
      expectStatus('create conflict with B refs', createWithBRefs.response.status, [404]);
    },
  },
  {
    name: 'A 店不能给 B 店会员记账或引用 B 店排期记账',
    run: async () => {
      const before = await queryOne<{ balance: number; transaction_count: number }>(
        `select c.balance, count(mt.id)::int as transaction_count
           from customers c left join membership_transactions mt on mt.customer_id = c.id
          where c.id = $1 group by c.id`,
        [b.customerId],
      );
      const bCustomer = await api(`/api/customers/${b.customerId}/transactions`, a.token, { method: 'POST', body: JSON.stringify({ transactionType: 'recharge', amount: 1, paymentMethod: 'cash' }) });
      expectStatus('transaction on B customer', bCustomer.response.status, [404]);
      const bSchedule = await api(`/api/customers/${a.customerId}/transactions`, a.token, { method: 'POST', body: JSON.stringify({ transactionType: 'recharge', amount: 1, paymentMethod: 'cash', scheduleId: b.scheduleId }) });
      expectStatus('transaction with B schedule', bSchedule.response.status, [404]);
      const after = await queryOne<{ balance: number; transaction_count: number }>(
        `select c.balance, count(mt.id)::int as transaction_count
           from customers c left join membership_transactions mt on mt.customer_id = c.id
          where c.id = $1 group by c.id`,
        [b.customerId],
      );
      assertOk(Number(after.balance) === Number(before.balance), '跨店交易改变了 B 店客户余额');
      assertOk(Number(after.transaction_count) === Number(before.transaction_count), '跨店交易写入了 B 店交易记录');
    },
  },
  {
    name: 'A 店玩家不能向 B 店排期提交加入申请',
    run: async () => {
      const result = await api(`/api/player/join-schedules/${b.scheduleId}/requests`, a.playerToken, {
        method: 'POST',
        body: JSON.stringify({ roleName: '角色一', note: `${marker}-cross-tenant` }),
      });
      expectStatus('player join B schedule', result.response.status, [404]);
      const inserted = await queryOne<{ count: number }>(
        `select count(*)::int as count from jzg_carpool_join_requests where schedule_id = $1 and player_id = $2`,
        [b.scheduleId, a.playerId],
      );
      assertOk(Number(inserted.count) === 0, '跨店玩家申请被写入 B 店排期');
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
  if (!process.env.JWT_SECRET) throw new Error('缺少 JWT_SECRET');
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
