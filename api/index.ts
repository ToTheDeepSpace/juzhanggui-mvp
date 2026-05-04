// Vercel Serverless 入口 — 自包含，由 @vercel/node 编译
// 所有核心路由内联在此文件

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://sntrybbtdkifgjfjgmuw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';

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
    const decoded = jwt.verify(auth.substring(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期' });
  }
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
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return res.status(401).json(err(new Error('密码错误')));
  res.json(ok({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) }));
});
app.get('/api/auth/verify', (_: any, res: any) => res.json(ok({ valid: true })));

// ===== Rooms =====
app.get('/api/rooms', async (_: any, res: any) => {
  try { const { data } = await supabase.from('rooms').select('*').eq('tenant_id', DEFAULT_TENANT_ID).order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/rooms', async (req: any, res: any) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写房间名称')));
    const { data } = await supabase.from('rooms').insert({ name, capacity: capacity || 0, tenant_id: DEFAULT_TENANT_ID, status: 'active' }).select().single();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').update(req.body).eq('id', req.params.id).eq('tenant_id', DEFAULT_TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').delete().eq('id', req.params.id).eq('tenant_id', DEFAULT_TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Scripts =====
app.get('/api/scripts', async (_: any, res: any) => {
  try {
    const { data: scripts } = await supabase.from('scripts').select('*').eq('tenant_id', DEFAULT_TENANT_ID).order('name');
    for (const s of scripts || []) {
      const [pr, ar] = await Promise.all([
        supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.id),
        supabase.from('script_actor_roles').select('role_name, gender').eq('script_id', s.id)
      ]);
      s.player_roles = (pr.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.actor_roles = (ar.data || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.player_count = pr.data?.length || 0;
      s.actor_count = ar.data?.length || 0;
      s.duration = s.duration_minutes || 0;
      s.min_duration = s.min_duration_hours ? Math.round(s.min_duration_hours * 60) : 0;
      s.max_duration = s.max_duration_hours ? Math.round(s.max_duration_hours * 60) : 0;
    }
    res.json(ok(scripts || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/scripts', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写名称')));
    const { data } = await supabase.from('scripts').insert({
      name, duration_minutes: minDuration,
      min_duration_hours: (minDuration || 0) / 60,
      max_duration_hours: (maxDuration || 0) / 60,
      tenant_id: DEFAULT_TENANT_ID
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

// ===== Player =====
app.post('/api/player/login', async (req: any, res: any) => {
  try {
    const { phone, displayName } = req.body;
    if (!phone) return res.status(400).json(err(new Error('请填写手机号')));
    if (!displayName) return res.status(400).json(err(new Error('请填写昵称')));
    let { data: p } = await supabase.from('players').select('*').eq('phone_hash', phone.trim()).eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle();
    if (p) {
      await supabase.from('players').update({ display_name: displayName.trim() }).eq('id', p.id);
    } else {
      const r = await supabase.from('players').insert({ phone_hash: phone.trim(), display_name: displayName.trim(), name_encrypted: displayName.trim(), tenant_id: DEFAULT_TENANT_ID }).select().single();
      p = r.data;
    }
    const token = jwt.sign({ role: 'player', playerId: p!.id, tenantId: DEFAULT_TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
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
