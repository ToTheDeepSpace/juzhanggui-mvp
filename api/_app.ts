// ==========================================
// 共享 Express App — Vercel + 本地开发共用
// 所有路由注册在此统一维护
// ==========================================

import express from 'express';
import cors from 'cors';
import { supabase, DEFAULT_TENANT_ID } from '../server/lib/supabase';
import { authMiddleware, generateToken } from '../server/middleware/auth';
import { ScheduleDB } from '../server/db';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// 修正 Vercel serverless 上的 req.url（重写后可能丢失原始路径）
app.use((req, _res, next) => {
  if ((req as any).originalUrl && (req as any).originalUrl !== req.url) {
    req.url = (req as any).originalUrl;
  }
  next();
});

app.use(authMiddleware);

// ===== 路由 — 全部直接注册在 app 上（避免 Vercel serverless 上 Router 兼容问题）=====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, error: '请输入密码' });
    const bcrypt = await import('bcryptjs');
    const hash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);
    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ success: false, error: '密码错误' });
    const token = generateToken({ role: 'admin' });
    res.json({ success: true, data: { token } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
});
app.get('/api/auth/verify', (_req, res) => res.json({ success: true, data: { valid: true } }));

// 健康检查
app.get('/api/health', (_req, res) => res.json({ success: true, message: '服务正常运行' }));

// 清理过期排期
app.post('/api/schedules/cleanup', async (_req, res) => {
  try {
    const count = await ScheduleDB.cleanupExpiredPending();
    res.json({ success: true, data: { expired: count } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
});

// 房间
app.get('/api/rooms', async (_req, res) => {
  try { const d = await supabase.from('rooms').select('*').eq('tenant_id', DEFAULT_TENANT_ID).order('name'); res.json({ success: true, data: d.data }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.post('/api/rooms', async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '请填写房间名称' });
    const d = await supabase.from('rooms').insert({ name, capacity: capacity || 0, tenant_id: DEFAULT_TENANT_ID, status: 'active' }).select().single();
    res.json({ success: true, data: { id: d.data?.id } });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.put('/api/rooms/:id', async (req, res) => {
  try { await supabase.from('rooms').update(req.body).eq('id', req.params.id).eq('tenant_id', DEFAULT_TENANT_ID); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.delete('/api/rooms/:id', async (req, res) => {
  try { await supabase.from('rooms').delete().eq('id', req.params.id).eq('tenant_id', DEFAULT_TENANT_ID); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});

// 卡司
app.get('/api/actors', async (_req, res) => {
  try { const d = await supabase.from('actors').select('*').order('name'); res.json({ success: true, data: d.data }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.post('/api/actors', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '请填写姓名' });
    const d = await supabase.from('actors').insert({ name, phone: phone || null }).select().single();
    res.json({ success: true, data: { id: d.data?.id } });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.put('/api/actors/:id', async (req, res) => {
  try { await supabase.from('actors').update({ name: req.body.name, phone: req.body.phone || null }).eq('id', req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.delete('/api/actors/:id', async (req, res) => {
  try { await supabase.from('actors').delete().eq('id', req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});

// 剧本
app.get('/api/scripts', async (_req, res) => {
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
    res.json({ success: true, data: scripts || [] });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.post('/api/scripts', async (req, res) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '请填写名称' });
    const { data } = await supabase.from('scripts').insert({
      name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60,
      max_duration_hours: (maxDuration || 0) / 60, tenant_id: DEFAULT_TENANT_ID
    }).select().single();
    if (!data) throw new Error('创建失败');
    for (const r of playerRoles || []) {
      const m = r.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_player_roles').insert({ script_id: data.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
    }
    for (const r of actorRoles || []) {
      const m = r.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_actor_roles').insert({ script_id: data.id, role_name: m ? m[1].trim() : r, gender: m?.[2]?.trim() || '' });
    }
    res.json({ success: true, data: { id: data.id } });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.get('/api/scripts/:id', async (req, res) => {
  try {
    const { data: s } = await supabase.from('scripts').select('*').eq('id', req.params.id).eq('tenant_id', DEFAULT_TENANT_ID).single();
    if (!s) return res.status(404).json({ success: false, error: '不存在' });
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
    s.duration = s.duration_minutes || 0;
    s.min_duration = s.min_duration_hours ? Math.round(s.min_duration_hours * 60) : 0;
    s.max_duration = s.max_duration_hours ? Math.round(s.max_duration_hours * 60) : 0;
    res.json({ success: true, data: s });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});

// 玩家
app.post('/api/player/login', async (req, res) => {
  try {
    const { phone, displayName } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: '请填写手机号' });
    if (!displayName) return res.status(400).json({ success: false, error: '请填写昵称' });
    let { data: existing } = await supabase.from('players').select('*').eq('phone_hash', phone.trim()).eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle();
    if (existing) {
      await supabase.from('players').update({ display_name: displayName.trim() }).eq('id', existing.id);
    } else {
      const { data: np } = await supabase.from('players').insert({ phone_hash: phone.trim(), display_name: displayName.trim(), name_encrypted: displayName.trim(), tenant_id: DEFAULT_TENANT_ID }).select().single();
      existing = np;
    }
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';
    const token = jwt.default.sign({ role: 'player', playerId: existing!.id, tenantId: DEFAULT_TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, data: { token, player: { id: existing!.id, displayName: existing!.display_name, phone: phone.trim(), totalGames: existing!.total_games || 0 } } });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});
app.get('/api/player/schedules', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'player') return res.status(403).json({ success: false, error: '无权限' });
    const { data: player } = await supabase.from('players').select('phone_hash').eq('id', user.playerId).maybeSingle();
    if (!player || !player.phone_hash) return res.json({ success: true, data: [] });
    const { data, error } = await supabase.from('checkins').select('*, schedules!inner(*, scripts(name), rooms(name))').eq('guest_phone', player.phone_hash).order('checked_at', { ascending: false });
    if (error) throw error;
    const schedules = (data || []).map((c: any) => ({
      checkinId: c.id, role: c.role, checkedAt: c.checked_at,
      schedule: c.schedules ? { id: c.schedules.id, scriptName: c.schedules.scripts?.name, roomName: c.schedules.rooms?.name, startTime: c.schedules.start_time, endTime: c.schedules.end_time, status: c.schedules.status, customerName: c.schedules.customer_name, playerCount: c.schedules.player_count } : null,
    }));
    res.json({ success: true, data: schedules });
  } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});

export default app;
