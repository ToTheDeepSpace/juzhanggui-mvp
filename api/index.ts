// ===========================
// 剧本杀排期系统 — Vercel Serverless 完整后端
// 所有逻辑自包含，无跨模块导入依赖
// ===========================

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// ===== Auth Middleware =====
const PUBLIC_PATHS = ['/api/health', '/api/auth/login', '/api/auth/verify'];
const PUBLIC_SUFFIXES = ['/public', '/checkin', '/evaluate', '/evaluation', '/evaluations', '/evaluation-stats'];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  for (const s of PUBLIC_SUFFIXES) if (path.endsWith(s)) return true;
  if (path.includes('/scripts/') && (path.endsWith('/evaluations') || path.endsWith('/evaluation-stats'))) return true;
  return false;
}

function authMiddleware(req: any, res: any, next: any) {
  if (isPublicPath(req.path) || req.method === 'OPTIONS') return next();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: '未登录' });
  try { jwt.verify(auth.substring(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ success: false, error: '登录已过期' }); }
}

// ===== Helpers =====
function ok(data?: any) { return { success: true, data }; }
function err(e: any) { return { success: false, error: e?.message || String(e) }; }

async function handle(handler: () => any, res: any) {
  try { const result = await handler(); res.json(ok(result)); }
  catch (e: any) { if (!res.headersSent) res.status(500).json(err(e)); }
}

// ===== App =====
const app = express();
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// ===== Auth Routes =====
app.post('/api/auth/login', async (req: any, res: any) => {
  const { password } = req.body;
  if (!password) return res.status(400).json(err(new Error('请输入密码')));
  const hash = bcrypt.hashSync('admin123', 10);
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return res.status(401).json(err(new Error('密码错误')));
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json(ok({ token }));
});

app.get('/api/auth/verify', (_: any, res: any) => res.json(ok({ valid: true })));

app.get('/api/health', (_: any, res: any) => res.json(ok({ message: 'OK' })));

// ===== Rooms =====
app.get('/api/rooms', (_: any, res: any) => handle(() => supabase.from('rooms').select('*').order('name').then(r => r.data), res));
app.post('/api/rooms', async (req: any, res: any) => {
  const { name, capacity } = req.body;
  if (!name) return res.status(400).json(err(new Error('请输入房间名称')));
  handle(() => supabase.from('rooms').insert({ name, capacity: capacity || 0 }).select().single().then(r => r.data), res);
});
app.put('/api/rooms/:id', async (req: any, res: any) => handle(() => supabase.from('rooms').update(req.body).eq('id', req.params.id), res));
app.delete('/api/rooms/:id', (req: any, res: any) => handle(() => supabase.from('rooms').delete().eq('id', req.params.id), res));
app.post('/api/rooms/batch-delete', async (req: any, res: any) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json(err(new Error('缺少 ids')));
  handle(async () => { for (const id of ids) await supabase.from('rooms').delete().eq('id', id); return ids.length; }, res);
});

// ===== Actors =====
app.get('/api/actors', (_: any, res: any) => handle(() => supabase.from('actors').select('*').order('name').then(r => r.data), res));
app.post('/api/actors', async (req: any, res: any) => {
  const { name, phone } = req.body;
  if (!name) return res.status(400).json(err(new Error('请填写卡司姓名')));
  handle(() => supabase.from('actors').insert({ name, phone: phone || null }).select().single().then(r => r.data), res);
});
app.put('/api/actors/:id', (req: any, res: any) => handle(() => supabase.from('actors').update({ name: req.body.name, phone: req.body.phone || null }).eq('id', req.params.id), res));
app.delete('/api/actors/:id', (req: any, res: any) => handle(() => supabase.from('actors').delete().eq('id', req.params.id), res));
app.post('/api/actors/batch-delete', async (req: any, res: any) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json(err(new Error('缺少 ids')));
  handle(async () => { for (const id of ids) await supabase.from('actors').delete().eq('id', id); return ids.length; }, res);
});
app.get('/api/actors/:id/skills', (req: any, res: any) => handle(() => supabase.from('actor_skills').select('*, scripts(name)').eq('actor_id', req.params.id).then(r => r.data), res));
app.post('/api/actors/:id/skills', async (req: any, res: any) => {
  const { scriptId, roleName, roleType, proficiency } = req.body;
  if (!scriptId || !roleName) return res.status(400).json(err(new Error('缺少参数')));
  handle(() => supabase.from('actor_skills').insert({ actor_id: req.params.id, script_id: scriptId, role_name: roleName, role_type: roleType || 'actor', proficiency: proficiency || 1 }).select().single().then(r => r.data), res);
});
app.delete('/api/actors/:actorId/skills/:scriptId/:roleName', (req: any, res: any) => handle(() => supabase.from('actor_skills').delete().eq('actor_id', req.params.actorId).eq('script_id', req.params.scriptId).eq('role_name', decodeURIComponent(req.params.roleName)), res));
app.get('/api/actors/:id/availability', async (req: any, res: any) => {
  const { date } = req.query;
  if (!date) return res.status(400).json(err(new Error('缺少date')));
  handle(async () => {
    const { data } = await supabase.from('schedule_actors').select('start_time, end_time').eq('actor_id', req.params.id).gte('start_time', `${date}T00:00:00`).lte('start_time', `${date}T23:59:59`).order('start_time');
    const occupied = (data || []).map((r: any) => ({ start: r.start_time, end: r.end_time }));
    const slots: any[] = [];
    let cursor = `${date}T09:00:00`, dayEnd = `${date}T23:00:00`;
    for (const o of occupied) { if (cursor < o.start) slots.push({ start: cursor, end: o.start }); if (o.end > cursor) cursor = o.end; }
    if (cursor < dayEnd) slots.push({ start: cursor, end: dayEnd });
    return slots;
  }, res);
});

// ===== Scripts =====
app.get('/api/scripts', async (_: any, res: any) => handle(async () => {
  const { data: scripts } = await supabase.from('scripts').select('*').order('name');
  for (const s of scripts || []) {
    const [pr, ar] = await Promise.all([
      supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.id),
      supabase.from('script_actor_roles').select('role_name, gender').eq('script_id', s.id)
    ]);
    s.player_roles = (pr.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    s.actor_roles = (ar.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    s.player_count = pr.data?.length || 0;
    s.actor_count = ar.data?.length || 0;
    s.duration = s.min_duration;
  }
  return scripts || [];
}, res));

app.get('/api/scripts/:id', async (req: any, res: any) => handle(async () => {
  const { data: s } = await supabase.from('scripts').select('*').eq('id', req.params.id).single();
  if (!s) throw new Error('剧本不存在');
  const [pr, ar, skills] = await Promise.all([
    supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.id),
    supabase.from('script_actor_roles').select('role_name, gender').eq('script_id', s.id),
    supabase.from('actor_skills').select('*, actors(name)').eq('script_id', s.id)
  ]);
  s.player_roles = (pr.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
  s.actor_roles = (ar.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
  s.skilled_actors = skills.data || [];
  s.player_count = pr.data?.length || 0;
  s.actor_count = ar.data?.length || 0;
  s.duration = s.min_duration;
  return s;
}, res));

app.post('/api/scripts', async (req: any, res: any) => handle(async () => {
  const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
  const { data } = await supabase.from('scripts').insert({ name, min_duration: minDuration, max_duration: maxDuration, duration: minDuration }).select().single();
  if (!data) throw new Error('创建失败');
  for (const r of playerRoles || []) {
    const m = r.match(/^(.+?)\s*\((.*?)\)$/);
    await supabase.from('script_player_roles').insert({ script_id: data.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
  }
  return data;
}, res));

app.put('/api/scripts/:id', async (req: any, res: any) => handle(async () => {
  const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
  await supabase.from('scripts').update({ name, min_duration: minDuration, max_duration: maxDuration, duration: minDuration }).eq('id', req.params.id);
  await supabase.from('script_player_roles').delete().eq('script_id', req.params.id);
  for (const r of playerRoles || []) { const m = r.match(/^(.+?)\s*\((.*?)\)$/); await supabase.from('script_player_roles').insert({ script_id: req.params.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' }); }
  return true;
}, res));

app.delete('/api/scripts/:id', (req: any, res: any) => handle(() => supabase.from('scripts').delete().eq('id', req.params.id), res));
app.post('/api/scripts/batch-delete', async (req: any, res: any) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json(err(new Error('缺少 ids')));
  handle(async () => { for (const id of ids) await supabase.from('scripts').delete().eq('id', id); return ids.length; }, res);
});

// ===== Schedules =====
app.get('/api/schedules', async (req: any, res: any) => handle(async () => {
  let q = supabase.from('schedules').select('*, scripts(name), rooms(name)').order('start_time');
  if (req.query.startDate) q = q.gte('start_time', req.query.startDate);
  if (req.query.endDate) q = q.lte('start_time', req.query.endDate);
  const { data } = await q;
  return (data || []).map((s: any) => ({ ...s, script_name: s.scripts?.name, room_name: s.rooms?.name }));
}, res));

app.get('/api/schedules/:id', async (req: any, res: any) => handle(async () => {
  const { data: s } = await supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('id', req.params.id).single();
  if (!s) throw new Error('排期不存在');
  const { data: actors } = await supabase.from('schedule_actors').select('*, actors(name)').eq('schedule_id', req.params.id);
  return { ...s, script_name: s.scripts?.name, room_name: s.rooms?.name, actors: actors || [] };
}, res));

app.post('/api/schedules', async (req: any, res: any) => handle(async () => {
  const d = req.body;
  const { data } = await supabase.from('schedules').insert({
    script_id: d.scriptId, room_id: d.roomId || null, start_time: d.startTime, end_time: d.endTime,
    status: d.status || 'pending', customer_name: d.customerName, customer_phone: d.customerPhone,
    player_count: d.playerCount, note: d.note
  }).select().single();
  if (!data) throw new Error('创建失败');
  if (d.actors) for (const a of d.actors) await supabase.from('schedule_actors').insert({ schedule_id: data.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime });
  return data;
}, res));

app.put('/api/schedules/:id', async (req: any, res: any) => handle(async () => {
  const d = req.body;
  const fields: any = {};
  if (d.scriptId !== undefined) fields.script_id = d.scriptId;
  if (d.roomId !== undefined) fields.room_id = d.roomId;
  if (d.startTime) fields.start_time = d.startTime;
  if (d.endTime) fields.end_time = d.endTime;
  if (d.status) fields.status = d.status;
  if (d.customerName !== undefined) fields.customer_name = d.customerName;
  if (d.customerPhone !== undefined) fields.customer_phone = d.customerPhone;
  if (d.playerCount !== undefined) fields.player_count = d.playerCount;
  if (d.note !== undefined) fields.note = d.note;
  await supabase.from('schedules').update(fields).eq('id', req.params.id);
  if (d.actors) {
    await supabase.from('schedule_actors').delete().eq('schedule_id', req.params.id);
    for (const a of d.actors) await supabase.from('schedule_actors').insert({ schedule_id: req.params.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime });
  }
  return true;
}, res));

app.delete('/api/schedules/:id', (req: any, res: any) => handle(() => supabase.from('schedules').delete().eq('id', req.params.id), res));
app.put('/api/schedules/:id/confirm', async (req: any, res: any) => {
  if (!req.body.roomId) return res.status(400).json(err(new Error('请选择房间')));
  handle(() => supabase.from('schedules').update({ room_id: req.body.roomId, status: 'scheduled' }).eq('id', req.params.id), res);
});
app.put('/api/schedules/:id/cancel', (req: any, res: any) => handle(() => supabase.from('schedules').update({ status: 'cancelled' }).eq('id', req.params.id), res));
app.get('/api/schedules/:id/public', async (req: any, res: any) => handle(async () => {
  const { data: s } = await supabase.from('schedules').select('*, scripts(name)').eq('id', req.params.id).single();
  if (!s) throw new Error('排期不存在');
  const { data: roles } = await supabase.from('script_roles').select('*').eq('script_id', s.script_id).order('start_offset');
  return { ...s, script_name: s.scripts?.name, roles: roles || [] };
}, res));
app.post('/api/schedules/:id/checkin', async (req: any, res: any) => {
  const { name, phone, role, avatar } = req.body;
  if (!name) return res.status(400).json(err(new Error('请填写姓名')));
  handle(() => supabase.from('checkins').insert({ schedule_id: req.params.id, guest_name: name, guest_phone: phone || null, role, guest_avatar: avatar || null }).select().single().then(r => r.data), res);
});
app.get('/api/schedules/:id/checkins', (req: any, res: any) => handle(() => supabase.from('checkins').select('*').eq('schedule_id', req.params.id).order('checked_at', { ascending: false }).then(r => r.data), res));
app.post('/api/schedules/:scheduleId/checkins/kick', async (req: any, res: any) => handle(() => supabase.from('checkins').delete().eq('schedule_id', req.params.scheduleId).eq('guest_name', req.body.guestName).eq('role', req.body.role), res));
app.get('/api/schedules/:id/evaluation', (req: any, res: any) => handle(() => supabase.from('evaluations').select('*').eq('schedule_id', req.params.id).order('created_at', { ascending: false }).then(r => r.data), res));
app.post('/api/schedules/:id/evaluate', async (req: any, res: any) => handle(() => supabase.from('evaluations').upsert({ schedule_id: req.params.id, guest_name: req.body.guestName, rating: req.body.rating, comment: req.body.comment || null }, { onConflict: 'schedule_id,guest_name' }), res));
app.get('/api/schedules/:id/conflicts', (req: any, res: any) => handle(() => supabase.from('conflict_records').select('*, customers(name), actors(name)').eq('schedule_id', req.params.id).order('conflict_date', { ascending: false }).then(r => r.data), res));

// ===== Customers =====
app.get('/api/customers', (_: any, res: any) => handle(() => supabase.from('customers').select('*').order('name').then(r => r.data), res));
app.get('/api/customers/search', (req: any, res: any) => {
  const q = req.query.q || '';
  handle(() => supabase.from('customers').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order('name').limit(20).then(r => r.data), res);
});
app.get('/api/customers/:id', async (req: any, res: any) => handle(async () => {
  const { data: c } = await supabase.from('customers').select('*').eq('id', req.params.id).single();
  if (!c) throw new Error('客户不存在');
  const { data: txs } = await supabase.from('membership_transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
  return { ...c, transactions: txs || [] };
}, res));
app.post('/api/customers', async (req: any, res: any) => handle(() => supabase.from('customers').insert({ name: req.body.name, phone: req.body.phone || null, membership_level: req.body.membershipLevel || 'none', balance: req.body.balance || 0 }).select().single().then(r => r.data), res));
app.put('/api/customers/:id', (req: any, res: any) => handle(() => supabase.from('customers').update(req.body).eq('id', req.params.id), res));
app.delete('/api/customers/:id', (req: any, res: any) => handle(() => supabase.from('customers').delete().eq('id', req.params.id), res));
app.post('/api/customers/:id/transactions', async (req: any, res: any) => handle(async () => {
  const { amount, transactionType, note, scheduleId } = req.body;
  if (!amount || !transactionType) throw new Error('缺少参数');
  const { data: c } = await supabase.from('customers').select('balance, total_recharged, total_consumed').eq('id', req.params.id).single();
  if (!c) throw new Error('客户不存在');
  const bal = transactionType === 'recharge' ? c.balance + amount : c.balance - amount;
  const upd: any = { balance: bal };
  if (transactionType === 'recharge') upd.total_recharged = (c.total_recharged || 0) + amount;
  if (transactionType === 'consume') upd.total_consumed = (c.total_consumed || 0) + amount;
  await supabase.from('customers').update(upd).eq('id', req.params.id);
  await supabase.from('membership_transactions').insert({ customer_id: req.params.id, schedule_id: scheduleId || null, amount: transactionType === 'recharge' ? amount : -amount, transaction_type: transactionType, note: note || null });
  return true;
}, res));
app.get('/api/customers/:id/preferences', (req: any, res: any) => handle(() => supabase.from('customer_preferences').select('*, actors(name)').eq('customer_id', req.params.id).then(r => r.data), res));
app.post('/api/customers/:id/preferences', (req: any, res: any) => handle(() => supabase.from('customer_preferences').insert({ customer_id: req.params.id, actor_id: req.body.actorId, preference_level: req.body.preferenceLevel || 1, notes: req.body.notes || null }).select().single().then(r => r.data), res));
app.put('/api/customers/preferences/:prefId', (req: any, res: any) => handle(() => supabase.from('customer_preferences').update({ preference_level: req.body.preferenceLevel, notes: req.body.notes }).eq('id', req.params.prefId), res));
app.delete('/api/customers/preferences/:prefId', (req: any, res: any) => handle(() => supabase.from('customer_preferences').delete().eq('id', req.params.prefId), res));
app.get('/api/customers/:id/conflicts', (req: any, res: any) => handle(() => supabase.from('conflict_records').select('*, actors(name)').eq('customer_id', req.params.id).order('created_at', { ascending: false }).then(r => r.data), res));

// ===== Conflicts =====
app.get('/api/conflicts/pending', (_: any, res: any) => handle(() => supabase.from('conflict_records').select('*, customers(name), actors(name)').eq('status', 'pending').order('conflict_date', { ascending: false }).then(r => r.data), res));
app.post('/api/conflicts', (req: any, res: any) => handle(() => supabase.from('conflict_records').insert({
  schedule_id: req.body.scheduleId, customer_id: req.body.customerId, actor_id: req.body.actorId,
  conflict_type: req.body.conflictType, conflict_description: req.body.conflictDescription,
  conflict_date: req.body.conflictDate, status: 'pending'
}).select().single().then(r => r.data), res));
app.put('/api/conflicts/:id', (req: any, res: any) => handle(() => supabase.from('conflict_records').update(req.body).eq('id', req.params.id), res));
app.delete('/api/conflicts/:id', (req: any, res: any) => handle(() => supabase.from('conflict_records').delete().eq('id', req.params.id), res));

// ===== Notifications =====
app.get('/api/notifications', async (_: any, res: any) => handle(async () => {
  const { data: notifications } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', 0);
  return { notifications: notifications || [], unreadCount: count || 0 };
}, res));
app.put('/api/notifications/:id/read', (req: any, res: any) => handle(() => supabase.from('notifications').update({ is_read: 1 }).eq('id', req.params.id), res));
app.put('/api/notifications/read-all', (_: any, res: any) => handle(() => supabase.from('notifications').update({ is_read: 1 }).eq('is_read', 0), res));

export default app;
