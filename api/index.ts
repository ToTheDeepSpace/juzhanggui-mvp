// Vercel Serverless 入口 — 自包含，由 @vercel/node 编译
// 所有路由内联在此文件

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(`juzhanggui:${phone.trim()}`).digest('hex');
}

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';

const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('⚠ JWT_SECRET env is not set — using fallback. Set it in Vercel dev dashboard!');

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
const PUBLIC_PATHS = ['/api/health', '/api/auth/login', '/api/auth/verify', '/api/player/login'];
const PUBLIC_SUFFIXES = ['/public', '/checkin', '/evaluate', '/evaluation', '/evaluations', '/evaluation-stats'];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  for (const s of PUBLIC_SUFFIXES) if (path.endsWith(s)) return true;
  if (path.includes('/scripts/') && (path.endsWith('/evaluations') || path.endsWith('/evaluation-stats'))) return true;
  return false;
}

app.use((req: any, res: any, next: any) => {
  if (req.originalUrl && req.originalUrl !== req.url) req.url = req.originalUrl;
  if (isPublicPath(req.path) || req.method === 'OPTIONS') return next();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: '未登录' });
  try {
    const decoded = jwt.verify(auth.substring(7), JWT_SECRET) as any;
    req.user = decoded;
    if (!req.path.startsWith('/api/player/') && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无管理员权限' });
    }
    next();
  }
  catch { res.status(401).json({ success: false, error: '登录已过期' }); }
});

function ok(d?: any) { return { success: true, data: d }; }
function err(e: any) { return { success: false, error: e?.message || String(e) }; }

// ===== Health =====
app.get('/api/health', (_: any, res: any) => res.json(ok({ message: 'OK' })));

// ===== Auth =====
app.post('/api/auth/login', async (req: any, res: any) => {
  const { password } = req.body;
  if (!password) return res.status(400).json(err(new Error('请输入密码')));
  const hash = bcrypt.hashSync('admin123', 10);
  if (!await bcrypt.compare(password, hash)) return res.status(401).json(err(new Error('密码错误')));
  res.json(ok({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) }));
});
app.get('/api/auth/verify', (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json(ok({ valid: false }));
  try { jwt.verify(auth.substring(7), JWT_SECRET); res.json(ok({ valid: true })); }
  catch { res.json(ok({ valid: false })); }
});

// ===== Rooms =====
app.get('/api/rooms', async (_: any, res: any) => {
  try { const { data } = await supabase.from('rooms').select('*').eq('tenant_id', TENANT_ID).order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/rooms', async (req: any, res: any) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写房间名称')));
    const { data } = await supabase.from('rooms').insert({ name, capacity: capacity || 0, tenant_id: TENANT_ID, status: 'active' }).select().single();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').update(req.body).eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').delete().eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Actors (卡司/DM) =====
app.get('/api/actors', async (_: any, res: any) => {
  try { const { data } = await supabase.from('actors').select('*').order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors', async (req: any, res: any) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写卡司姓名')));
    const { data } = await supabase.from('actors').insert({ name, phone: phone || null }).select().single();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/actors/:id', async (req: any, res: any) => {
  try { await supabase.from('actors').update({ name: req.body.name, phone: req.body.phone || null }).eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/actors/:id', async (req: any, res: any) => {
  try { await supabase.from('actors').delete().eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/actors/:id/skills', async (req: any, res: any) => {
  try { const { data } = await supabase.from('actor_skills').select('*, scripts(name)').eq('actor_id', req.params.id); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors/:id/skills', async (req: any, res: any) => {
  try {
    const { scriptId, roleName, roleType, proficiency } = req.body;
    if (!scriptId || !roleName) return res.status(400).json(err(new Error('缺少参数')));
    const { data } = await supabase.from('actor_skills').insert({ actor_id: req.params.id, script_id: scriptId, role_name: roleName, role_type: roleType || 'actor', proficiency: proficiency || 1 }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Scripts =====
app.get('/api/scripts', async (_: any, res: any) => {
  try {
    const { data: scripts } = await supabase.from('scripts').select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)').eq('tenant_id', TENANT_ID).order('name');
    for (const s of scripts || []) {
      s.player_roles = (s.script_player_roles || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.actor_roles = (s.script_actor_roles || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.player_count = s.script_player_roles?.length || 0;
      s.actor_count = s.script_actor_roles?.length || 0;
      s.duration = s.duration_minutes || 0;
      s.min_duration = s.min_duration_hours ? Math.round(s.min_duration_hours * 60) : 0;
      s.max_duration = s.max_duration_hours ? Math.round(s.max_duration_hours * 60) : 0;
      delete s.script_player_roles;
      delete s.script_actor_roles;
    }
    res.json(ok(scripts || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('scripts').select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)').eq('id', req.params.id).eq('tenant_id', TENANT_ID).single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: skills } = await supabase.from('actor_skills').select('*, actors(name)').eq('script_id', s.id);
    s.player_roles = (s.script_player_roles || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    s.actor_roles = (s.script_actor_roles || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    s.skilled_actors = skills || [];
    s.player_count = s.script_player_roles?.length || 0;
    s.actor_count = s.script_actor_roles?.length || 0;
    s.duration = s.duration_minutes || 0;
    s.min_duration = s.min_duration_hours ? Math.round(s.min_duration_hours * 60) : 0;
    s.max_duration = s.max_duration_hours ? Math.round(s.max_duration_hours * 60) : 0;
    delete s.script_player_roles;
    delete s.script_actor_roles;
    res.json(ok(s));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/scripts', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写名称')));
    const { data } = await supabase.from('scripts').insert({
      name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60, max_duration_hours: (maxDuration || 0) / 60, tenant_id: TENANT_ID
    }).select().single();
    for (const r of playerRoles || []) {
      const m = r.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_player_roles').insert({ script_id: data!.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
    }
    for (const r of actorRoles || []) {
      const m = r.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_actor_roles').insert({ script_id: data!.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
    }
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/scripts/:id', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    await supabase.from('scripts').update({ name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60, max_duration_hours: (maxDuration || 0) / 60 }).eq('id', req.params.id);
    await supabase.from('script_player_roles').delete().eq('script_id', req.params.id);
    for (const r of playerRoles || []) {
      const m = r.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_player_roles').insert({ script_id: req.params.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/scripts/:id', async (req: any, res: any) => {
  try { await supabase.from('scripts').delete().eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Schedules =====
app.get('/api/schedules', async (req: any, res: any) => {
  try {
    let q = supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('tenant_id', TENANT_ID).order('scheduled_date');
    if (req.query.startDate) q = q.gte('scheduled_date', req.query.startDate);
    if (req.query.endDate) q = q.lte('scheduled_date', req.query.endDate);
    const { data } = await q;
    res.json(ok((data || []).map((s: any) => ({
      ...s, script_name: s.scripts?.name, room_name: s.rooms?.name,
      start_time: `${s.scheduled_date}T${s.start_time}`,
      end_time: `${s.scheduled_date}T${s.end_time}`,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('id', req.params.id).single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: actors } = await supabase.from('schedule_actors').select('*, actors(name)').eq('schedule_id', req.params.id);
    res.json(ok({
      ...s, script_name: s.scripts?.name, room_name: s.rooms?.name, actors: actors || [],
      start_time: `${s.scheduled_date}T${s.start_time}`,
      end_time: `${s.scheduled_date}T${s.end_time}`,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id/public', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('schedules').select('*, scripts(name)').eq('id', req.params.id).single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: roles } = await supabase.from('script_roles').select('*').eq('script_id', s.script_id).order('start_offset');
    // 获取玩家可选角色
    const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name').eq('script_id', s.script_id);
    // 获取已选角色
    const { data: checkins } = await supabase.from('checkins').select('role').eq('schedule_id', req.params.id).not('role', 'is', null);
    res.json(ok({
      ...s, script_name: s.scripts?.name, roles: roles || [],
      player_roles: (playerRoles || []).map((r: any) => r.role_name),
      taken_roles: (checkins || []).map((c: any) => c.role),
      start_time: `${s.scheduled_date}T${s.start_time}`,
      end_time: `${s.scheduled_date}T${s.end_time}`,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules', async (req: any, res: any) => {
  try {
    const d = req.body;
    // 优先使用前端直接传的时间字符串（避免时区转换问题）
    const dateStr = d.date || (d.startTime ? d.startTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    const startTimeStr = d.timeStart || (d.startTime ? d.startTime.split('T')[1]?.substring(0, 5) : '14:00');
    const endTimeStr = d.timeEnd || (d.endTime ? d.endTime.split('T')[1]?.substring(0, 5) : '17:00');
    const { data } = await supabase.from('schedules').insert({
      script_id: d.scriptId, room_id: d.roomId || null,
      scheduled_date: dateStr, start_time: startTimeStr, end_time: endTimeStr,
      status: d.status || 'pending', player_count: d.playerCount || 0,
      tenant_id: TENANT_ID
    }).select().single();
    if (d.actors && d.actors.length) await supabase.from('schedule_actors').insert(d.actors.map((a: any) => ({ schedule_id: data!.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const d = req.body;
    const fields: any = {};
    if (d.scriptId !== undefined) fields.script_id = d.scriptId;
    if (d.roomId !== undefined) fields.room_id = d.roomId;
    if (d.startTime) {
      const s = new Date(d.startTime);
      fields.scheduled_date = s.toISOString().split('T')[0];
      fields.start_time = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`;
    }
    if (d.endTime) {
      const e = new Date(d.endTime);
      fields.end_time = `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`;
    }
    if (d.status) fields.status = d.status;
    if (d.customerName !== undefined) fields.customer_name = d.customerName;
    if (d.customerPhone !== undefined) fields.customer_phone = d.customerPhone;
    if (d.playerCount !== undefined) fields.player_count = d.playerCount;
    if (d.note !== undefined) fields.note = d.note;
    await supabase.from('schedules').update(fields).eq('id', req.params.id);
    if (d.actors) {
      await supabase.from('schedule_actors').delete().eq('schedule_id', req.params.id);
      if (d.actors.length) await supabase.from('schedule_actors').insert(d.actors.map((a: any) => ({ schedule_id: req.params.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/schedules/:id', async (req: any, res: any) => {
  try { await supabase.from('schedules').delete().eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/confirm', async (req: any, res: any) => {
  try {
    if (!req.body.roomId) return res.status(400).json(err(new Error('请选择房间')));
    await supabase.from('schedules').update({ room_id: req.body.roomId, status: 'scheduled' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/cancel', async (req: any, res: any) => {
  try { await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Checkins =====
app.get('/api/schedules/:id/checkins', async (req: any, res: any) => {
  try { const { data } = await supabase.from('checkins').select('*').eq('schedule_id', req.params.id).order('checked_at', { ascending: false }); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/checkin', async (req: any, res: any) => {
  try {
    const { name, phone, role, avatar } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写姓名')));
    const { data } = await supabase.from('checkins').insert({ schedule_id: req.params.id, guest_name: name, guest_phone: phone ? hashPhone(phone) : null, role, guest_avatar: avatar || null }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Evaluation =====
app.get('/api/schedules/:id/evaluation', async (req: any, res: any) => {
  try { const { data } = await supabase.from('evaluations').select('*').eq('schedule_id', req.params.id).order('created_at', { ascending: false }); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/evaluate', async (req: any, res: any) => {
  try { await supabase.from('evaluations').upsert({ schedule_id: req.params.id, guest_name: req.body.guestName, rating: req.body.rating, comment: req.body.comment || null }, { onConflict: 'schedule_id,guest_name' }); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id/evaluations', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('evaluations').select('*, schedules!inner(script_id, start_time), scripts!inner(name)').eq('schedules.script_id', req.params.id).order('created_at', { ascending: false });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id/evaluation-stats', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('evaluations').select('rating, schedules!inner(script_id)').eq('schedules.script_id', req.params.id);
    const ratings = (data || []).map((r: any) => r.rating);
    if (!ratings.length) return res.json(ok({ total: 0, avgRating: null, minRating: null, maxRating: null }));
    res.json(ok({ total: ratings.length, avgRating: Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10, minRating: Math.min(...ratings), maxRating: Math.max(...ratings) }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Customers =====
app.get('/api/customers', async (_: any, res: any) => {
  try { const { data } = await supabase.from('customers').select('*').order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/customers/search', async (req: any, res: any) => {
  try {
    const q = req.query.q || '';
    const { data } = await supabase.from('customers').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order('name').limit(20);
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/customers', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('customers').insert({ name: req.body.name, phone: req.body.phone || null, membership_level: req.body.membershipLevel || 'none', balance: req.body.balance || 0 }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').update(req.body).eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').delete().eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Notifications =====
app.get('/api/notifications', async (_: any, res: any) => {
  try {
    const { data: notifications } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', 0);
    res.json(ok({ notifications: notifications || [], unreadCount: count || 0 }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/notifications/:id/read', async (req: any, res: any) => {
  try { await supabase.from('notifications').update({ is_read: 1 }).eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/notifications/read-all', async (_: any, res: any) => {
  try { await supabase.from('notifications').update({ is_read: 1 }).eq('is_read', 0); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Conflicts =====
app.get('/api/conflicts/pending', async (_: any, res: any) => {
  try { const { data } = await supabase.from('conflict_records').select('*, customers(name), actors(name)').eq('status', 'pending').order('conflict_date', { ascending: false }); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/conflicts', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('conflict_records').insert({
      schedule_id: req.body.scheduleId, customer_id: req.body.customerId, actor_id: req.body.actorId,
      conflict_type: req.body.conflictType, conflict_description: req.body.conflictDescription,
      conflict_date: req.body.conflictDate, status: 'pending'
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/conflicts/:id', async (req: any, res: any) => {
  try { await supabase.from('conflict_records').update(req.body).eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/conflicts/:id', async (req: any, res: any) => {
  try { await supabase.from('conflict_records').delete().eq('id', req.params.id); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Player =====
app.post('/api/player/login', async (req: any, res: any) => {
  try {
    const { phone, displayName } = req.body;
    if (!phone) return res.status(400).json(err(new Error('请填写手机号')));
    if (!displayName) return res.status(400).json(err(new Error('请填写昵称')));
    const phoneHash = hashPhone(phone);
    let { data: p } = await supabase.from('players').select('*').eq('phone_hash', phoneHash).eq('tenant_id', TENANT_ID).maybeSingle();
    if (p) { await supabase.from('players').update({ display_name: displayName.trim() }).eq('id', p.id); }
    else { const r = await supabase.from('players').insert({ phone_hash: phoneHash, display_name: displayName.trim(), name_encrypted: displayName.trim(), tenant_id: TENANT_ID }).select().single(); p = r.data; }
    const token = jwt.sign({ role: 'player', playerId: p!.id, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({ token, player: { id: p!.id, displayName: p!.display_name, phone: phone.trim(), totalGames: p!.total_games || 0 } }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/player/schedules', async (req: any, res: any) => {
  try {
    if (!req.user || req.user.role !== 'player') return res.status(403).json(err(new Error('无权限')));
    const { data: player } = await supabase.from('players').select('phone_hash').eq('id', req.user.playerId).maybeSingle();
    if (!player?.phone_hash) return res.json(ok([]));
    const { data, error } = await supabase.from('checkins').select('*, schedules!inner(*, scripts(name), rooms(name))').eq('guest_phone', player.phone_hash).order('checked_at', { ascending: false });
    if (error) throw error;
    res.json(ok((data || []).map((c: any) => ({
      checkinId: c.id, role: c.role, checkedAt: c.checked_at,
      schedule: c.schedules ? { id: c.schedules.id, scriptName: c.schedules.scripts?.name, roomName: c.schedules.rooms?.name, startTime: c.schedules.start_time, endTime: c.schedules.end_time, status: c.schedules.status, customerName: c.schedules.customer_name, playerCount: c.schedules.player_count } : null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

export default app;
