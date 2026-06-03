// Vercel Serverless 入口 — 自包含，由 @vercel/node 编译
// 所有路由内联在此文件

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
const PLAYER_LOGIN_CODE = process.env.PLAYER_LOGIN_CODE || (process.env.NODE_ENV === 'production' ? '' : '8888');
const AUTH_CODE_PEPPER = process.env.AUTH_CODE_PEPPER || JWT_SECRET;
const SMS_CODE_TTL_MINUTES = Number(process.env.SMS_CODE_TTL_MINUTES || 5);
const SMS_CODE_COOLDOWN_SECONDS = Number(process.env.SMS_CODE_COOLDOWN_SECONDS || 60);
const TENCENT_SMS_REGION = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';
const TENCENT_SMS_SDK_APP_ID = process.env.TENCENT_SMS_SDK_APP_ID || '';
const TENCENT_SMS_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME || '';
const TENCENT_SMS_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID || '';
const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || '';
const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || '';
const JUZHANGGUI_SITE_URL = (process.env.JUZHANGGUI_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://jusichen.com').replace(/\/$/, '');
const JZG_WECHAT_OPEN_APP_ID = process.env.JZG_WECHAT_OPEN_APP_ID || process.env.WECHAT_OPEN_APP_ID || '';
const JZG_WECHAT_OPEN_APP_SECRET = process.env.JZG_WECHAT_OPEN_APP_SECRET || process.env.WECHAT_OPEN_APP_SECRET || '';
const JZG_WECHAT_REDIRECT_URI = process.env.JZG_WECHAT_REDIRECT_URI || `${JUZHANGGUI_SITE_URL}/api/player/wechat/callback`;

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
const PUBLIC_PATHS = ['/api/health', '/api/auth/login', '/api/auth/verify', '/api/player/auth/config', '/api/player/login', '/api/player/send-code', '/api/player/verify-code', '/api/player/wechat/url', '/api/player/wechat/start', '/api/player/wechat/callback'];
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
function sha256(input: string): string { return crypto.createHash('sha256').update(input).digest('hex'); }
function normalizeChinaPhone(input: unknown): string {
  const phone = typeof input === 'string' ? input.replace(/\D/g, '') : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请填写正确的中国大陆手机号');
  return phone;
}
function makeAuthPhoneHash(phone: string) { return sha256(`auth-phone:${phone}`); }
function makeAuthCodeHash(phone: string, code: string) { return sha256(`auth-code:${AUTH_CODE_PEPPER}:${phone}:${code}`); }
function makeSmsCode() {
  if (process.env.NODE_ENV !== 'production' && PLAYER_LOGIN_CODE) return PLAYER_LOGIN_CODE;
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function getClientIp(req: any) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}
function getUserAgent(req: any) {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || null;
}
function isTencentSmsConfigured() {
  return Boolean(TENCENTCLOUD_SECRET_ID && TENCENTCLOUD_SECRET_KEY && TENCENT_SMS_SDK_APP_ID && TENCENT_SMS_SIGN_NAME && TENCENT_SMS_TEMPLATE_ID);
}
function isPhoneCodeLoginAvailable() {
  return isTencentSmsConfigured() || process.env.NODE_ENV !== 'production';
}
function isWechatLoginConfigured() { return Boolean(JZG_WECHAT_OPEN_APP_ID && JZG_WECHAT_OPEN_APP_SECRET); }
function safeFrontendRedirect(input: unknown) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/player/dashboard';
  return raw.slice(0, 120);
}
function makeWechatAuthorizeUrl(redirectPath: string) {
  const state = jwt.sign({ kind: 'jzg_wechat_login', redirectPath }, JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    appid: JZG_WECHAT_OPEN_APP_ID,
    redirect_uri: JZG_WECHAT_REDIRECT_URI,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}
async function sendTencentSmsCode(phone: string, code: string) {
  if (!isTencentSmsConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('短信服务未配置');
    console.log(`[验证码][dev] 发送到 ${phone}: ${code}`);
    return { provider: 'dev-log' };
  }
  const imported = await import('tencentcloud-sdk-nodejs');
  const tencentcloud = (imported as unknown as { default?: any }).default || imported as any;
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId: TENCENTCLOUD_SECRET_ID, secretKey: TENCENTCLOUD_SECRET_KEY },
    region: TENCENT_SMS_REGION,
    profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com', reqMethod: 'POST', reqTimeout: 10 } },
  });
  const response = await client.SendSms({
    SmsSdkAppId: TENCENT_SMS_SDK_APP_ID,
    SignName: TENCENT_SMS_SIGN_NAME,
    TemplateId: TENCENT_SMS_TEMPLATE_ID,
    TemplateParamSet: [code, String(SMS_CODE_TTL_MINUTES)],
    PhoneNumberSet: [`+86${phone}`],
  });
  const status = response?.SendStatusSet?.[0];
  if (status && status.Code && status.Code !== 'Ok') throw new Error(status.Message || `短信发送失败：${status.Code}`);
  return { provider: 'tencentcloud' };
}
async function createAndSendPhoneCode(req: any, purpose: string, rawPhone: unknown) {
  const phone = normalizeChinaPhone(rawPhone);
  const phoneHash = makeAuthPhoneHash(phone);
  const { data: latest, error: latestErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, created_at')
    .eq('project', 'juzhanggui')
    .eq('purpose', purpose)
    .eq('phone_hash', phoneHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  if (latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < SMS_CODE_COOLDOWN_SECONDS * 1000) {
    throw new Error(`验证码已发送，请 ${SMS_CODE_COOLDOWN_SECONDS} 秒后再试`);
  }
  const code = makeSmsCode();
  const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const { data: row, error: insertErr } = await supabase.from('lc_auth_verification_codes').insert({
    project: 'juzhanggui',
    purpose,
    phone_hash: phoneHash,
    phone_last4: phone.slice(-4),
    code_hash: makeAuthCodeHash(phone, code),
    ip_address: getClientIp(req),
    user_agent: getUserAgent(req),
    expires_at: expiresAt,
  }).select('id').single();
  if (insertErr) throw insertErr;
  try {
    const sent = await sendTencentSmsCode(phone, code);
    return { phone, expiresAt, provider: sent.provider };
  } catch (sendErr) {
    if (row?.id) await supabase.from('lc_auth_verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    throw sendErr;
  }
}
async function verifyPhoneCode(purpose: string, rawPhone: unknown, rawCode: unknown) {
  const phone = normalizeChinaPhone(rawPhone);
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : '';
  if (!/^\d{4,8}$/.test(code)) throw new Error('请填写正确的验证码');
  const { data: row, error: qErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('project', 'juzhanggui')
    .eq('purpose', purpose)
    .eq('phone_hash', makeAuthPhoneHash(phone))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row) throw new Error('请先获取验证码');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('验证码已过期，请重新获取');
  if ((row.attempts || 0) >= 5) throw new Error('验证码错误次数过多，请重新获取');
  if (row.code_hash !== makeAuthCodeHash(phone, code)) {
    await supabase.from('lc_auth_verification_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
    throw new Error('验证码错误');
  }
  await supabase.from('lc_auth_verification_codes').update({ attempts: (row.attempts || 0) + 1, consumed_at: new Date().toISOString() }).eq('id', row.id);
  return phone;
}
function parseRole(role: string): { role_name: string; gender: string } {
  const m = role.match(/^(.+?)\s*\((.*?)\)$/);
  return { role_name: m ? m[1].trim() : role, gender: m?.[2]?.trim() || '' };
}

function serializeRoles(rows: any[] | null | undefined) {
  return (rows || []).map((r: any) => ({
    role_name: r.role_name,
    gender: r.gender || '',
  }));
}

// ===== Health =====
app.get('/api/health', (_: any, res: any) => res.json(ok({ message: 'OK' })));

// ===== Auth =====
app.post('/api/auth/login', async (req: any, res: any) => {
  const { password } = req.body;
  if (!password) return res.status(400).json(err(new Error('请输入密码')));
  if (!ADMIN_PASSWORD) return res.status(500).json(err(new Error('管理员密码未配置')));
  if (password !== ADMIN_PASSWORD) return res.status(401).json(err(new Error('密码错误')));
  res.json(ok({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) }));
});
app.get('/api/auth/verify', (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json(ok({ valid: false }));
  try { jwt.verify(auth.substring(7), JWT_SECRET); res.json(ok({ valid: true })); }
  catch { res.json(ok({ valid: false })); }
});

// ===== Stores / 多店家后台 =====
app.get('/api/stores', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_stores').select('*').order('created_at', { ascending: false });
    if (error && String(error.message || '').includes('jzg_stores')) {
      return res.json(ok([{ id: TENANT_ID, name: '默认店家', city: '未设置', status: 'active' }]));
    }
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/stores', async (req: any, res: any) => {
  try {
    const { name, city, address, contact } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写店家名称')));
    const { data, error } = await supabase.from('jzg_stores').insert({
      name: String(name).trim(),
      city: city ? String(city).trim() : null,
      address: address ? String(address).trim() : null,
      contact: contact ? String(contact).trim() : null,
      status: 'active',
    }).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Script Templates / 公共剧本模版 =====
app.get('/api/script-templates', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_script_templates')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (error && String(error.message || '').includes('jzg_script_templates')) return res.json(ok([]));
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/scripts/:id/publish-template', async (req: any, res: any) => {
  try {
    const { data: s, error: scriptErr } = await supabase.from('scripts')
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)')
      .eq('id', req.params.id)
      .eq('tenant_id', TENANT_ID)
      .single();
    if (scriptErr) throw scriptErr;
    if (!s) return res.status(404).json(err(new Error('剧本不存在')));

    const payload = {
      source_script_id: s.id,
      source_tenant_id: TENANT_ID,
      name: s.name,
      duration_minutes: s.duration_minutes || s.duration || 240,
      min_duration_hours: s.min_duration_hours || ((s.min_duration || s.duration_minutes || 240) / 60),
      max_duration_hours: s.max_duration_hours || ((s.max_duration || s.duration_minutes || 240) / 60),
      dm_gender: s.dm_gender || '未指定',
      player_roles: serializeRoles(s.script_player_roles),
      actor_roles: serializeRoles(s.script_actor_roles),
      created_by: '剧司辰后台',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('jzg_script_templates')
      .upsert(payload, { onConflict: 'source_script_id,source_tenant_id' })
      .select()
      .single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/script-templates/:id/import', async (req: any, res: any) => {
  try {
    const { data: t, error: templateErr } = await supabase.from('jzg_script_templates').select('*').eq('id', req.params.id).single();
    if (templateErr) throw templateErr;
    if (!t) return res.status(404).json(err(new Error('模版不存在')));

    const { data: existing } = await supabase.from('scripts')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('name', t.name)
      .maybeSingle();
    if (existing) return res.json(ok({ id: existing.id, existing: true }));

    const { data: script, error: scriptErr } = await supabase.from('scripts').insert({
      name: t.name,
      duration_minutes: t.duration_minutes || 240,
      min_duration_hours: t.min_duration_hours || 4,
      max_duration_hours: t.max_duration_hours || 4,
      tenant_id: TENANT_ID,
    }).select().single();
    if (scriptErr) throw scriptErr;

    const playerRoles = Array.isArray(t.player_roles) ? t.player_roles : [];
    const actorRoles = Array.isArray(t.actor_roles) ? t.actor_roles : [];
    if (playerRoles.length) {
      await supabase.from('script_player_roles').insert(playerRoles.map((r: any) => ({
        script_id: script!.id,
        role_name: r.role_name,
        gender: r.gender || '',
      })));
    }
    if (actorRoles.length) {
      await supabase.from('script_actor_roles').insert(actorRoles.map((r: any) => ({
        script_id: script!.id,
        role_name: r.role_name,
        gender: r.gender || '',
      })));
    }
    await supabase.from('jzg_script_templates').update({
      usage_count: (t.usage_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id);
    res.json(ok({ id: script?.id, existing: false }));
  } catch (e) { res.status(500).json(err(e)); }
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
  try {
    const { data } = await supabase.from('actors').select('*').eq('tenant_id', TENANT_ID).order('name');
    // 为每个卡司查找对应的灵契主页
    const enriched = await Promise.all((data || []).map(async (a: any) => {
      if (a.phone) {
        const { data: lc } = await supabase.from('lc_profiles').select('id, display_name').eq('phone', a.phone).maybeSingle();
        return { ...a, lc_profile: lc || null };
      }
      return { ...a, lc_profile: null };
    }));
    res.json(ok(enriched));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors', async (req: any, res: any) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写卡司姓名')));
    const { data } = await supabase.from('actors').insert({ name, phone: phone || null, tenant_id: TENANT_ID }).select().single();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/actors/:id', async (req: any, res: any) => {
  try { await supabase.from('actors').update({ name: req.body.name, phone: req.body.phone || null }).eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/actors/:id', async (req: any, res: any) => {
  try { await supabase.from('actors').delete().eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/actors/:id/skills', async (req: any, res: any) => {
  try {
    const { data: actor } = await supabase.from('actors').select('id').eq('id', req.params.id).eq('tenant_id', TENANT_ID).maybeSingle();
    if (!actor) return res.status(404).json(err(new Error('卡司不存在')));
    const { data } = await supabase.from('actor_skills').select('*, scripts(name)').eq('actor_id', req.params.id);
    res.json(ok(data));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors/:id/skills', async (req: any, res: any) => {
  try {
    const { scriptId, roleName, roleType, proficiency } = req.body;
    if (!scriptId || !roleName) return res.status(400).json(err(new Error('缺少参数')));
    const [{ data: actor }, { data: script }] = await Promise.all([
      supabase.from('actors').select('id').eq('id', req.params.id).eq('tenant_id', TENANT_ID).maybeSingle(),
      supabase.from('scripts').select('id').eq('id', scriptId).eq('tenant_id', TENANT_ID).maybeSingle(),
    ]);
    if (!actor || !script) return res.status(404).json(err(new Error('卡司或剧本不存在')));
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
      await supabase.from('script_player_roles').insert({ script_id: data!.id, ...parseRole(r) });
    }
    for (const r of actorRoles || []) {
      await supabase.from('script_actor_roles').insert({ script_id: data!.id, ...parseRole(r) });
    }
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/scripts/:id', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    await supabase.from('scripts').update({ name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60, max_duration_hours: (maxDuration || 0) / 60 }).eq('id', req.params.id).eq('tenant_id', TENANT_ID);
    await supabase.from('script_player_roles').delete().eq('script_id', req.params.id);
    await supabase.from('script_actor_roles').delete().eq('script_id', req.params.id);
    for (const r of playerRoles || []) {
      await supabase.from('script_player_roles').insert({ script_id: req.params.id, ...parseRole(r) });
    }
    for (const r of actorRoles || []) {
      await supabase.from('script_actor_roles').insert({ script_id: req.params.id, ...parseRole(r) });
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/scripts/:id', async (req: any, res: any) => {
  try { await supabase.from('scripts').delete().eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Schedules =====
app.get('/api/schedules', async (req: any, res: any) => {
  try {
    let q = supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('tenant_id', TENANT_ID).order('scheduled_date');
    if (req.query.startDate) q = q.gte('scheduled_date', req.query.startDate);
    if (req.query.endDate) q = q.lte('scheduled_date', req.query.endDate);
    const { data } = await q;
    // 获取每个排期的签到人数
    const schedulesWithCheckins = await Promise.all((data || []).map(async (s: any) => {
      const { data: checkins } = await supabase.from('checkins').select('role').eq('schedule_id', s.id);
      const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.script_id);
      return {
        ...s, script_name: s.scripts?.name, room_name: s.rooms?.name,
        start_time: `${s.scheduled_date}T${s.start_time}`,
        end_time: `${s.scheduled_date}T${s.end_time}`,
        checkins: checkins || [],
        player_roles: (playerRoles || []).map((r: any) => ({ name: r.role_name, gender: r.gender || '' })),
      };
    }));
    res.json(ok(schedulesWithCheckins));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('id', req.params.id).eq('tenant_id', TENANT_ID).single();
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
    const { data: s } = await supabase.from('schedules').select('*, scripts(name)').eq('id', req.params.id).eq('tenant_id', TENANT_ID).single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: roles } = await supabase.from('script_roles').select('*').eq('script_id', s.script_id).order('start_offset');
    // 获取玩家可选角色（含性别）
    const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.script_id);
    // 获取已选角色（含性别）
    const { data: checkins } = await supabase.from('checkins').select('role').eq('schedule_id', req.params.id).not('role', 'is', null);
    res.json(ok({
      ...s, script_name: s.scripts?.name, roles: roles || [],
      player_roles: (playerRoles || []).map((r: any) => ({ name: r.role_name, gender: r.gender || '' })),
      taken_roles: (checkins || []).map((c: any) => c.role),
      checkins: (checkins || []).map((c: any) => ({ role: c.role, gender: '' })),
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
      fields.scheduled_date = d.date || d.startTime.split('T')[0];
      fields.start_time = d.timeStart || d.startTime.split('T')[1]?.substring(0, 5);
    }
    if (d.endTime) {
      fields.end_time = d.timeEnd || d.endTime.split('T')[1]?.substring(0, 5);
    }
    if (d.status) fields.status = d.status;
    if (d.customerName !== undefined) fields.customer_name = d.customerName;
    if (d.customerPhone !== undefined) fields.customer_phone = d.customerPhone;
    if (d.playerCount !== undefined) fields.player_count = d.playerCount;
    if (d.note !== undefined) fields.note = d.note;
    await supabase.from('schedules').update(fields).eq('id', req.params.id).eq('tenant_id', TENANT_ID);
    if (d.actors) {
      await supabase.from('schedule_actors').delete().eq('schedule_id', req.params.id);
      if (d.actors.length) await supabase.from('schedule_actors').insert(d.actors.map((a: any) => ({ schedule_id: req.params.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/schedules/:id', async (req: any, res: any) => {
  try { await supabase.from('schedules').delete().eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/confirm', async (req: any, res: any) => {
  try {
    if (!req.body.roomId) return res.status(400).json(err(new Error('请选择房间')));
    await supabase.from('schedules').update({ room_id: req.body.roomId, status: 'scheduled' }).eq('id', req.params.id).eq('tenant_id', TENANT_ID);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/cancel', async (req: any, res: any) => {
  try { await supabase.from('schedules').update({ status: req.body.status || 'cancelled' }).eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/complete', async (req: any, res: any) => {
  try { await supabase.from('schedules').update({ status: 'completed' }).eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/dm-start', async (req: any, res: any) => {
  try {
    const { actorId } = req.body;
    await supabase.from('schedules').update({ status: 'ongoing', scheduled_date: new Date().toISOString().split('T')[0], start_time: new Date().toISOString().split('T')[1]?.substring(0, 5) }).eq('id', req.params.id).eq('tenant_id', TENANT_ID);
    if (actorId) {
      await supabase.from('schedule_actors').insert({ schedule_id: req.params.id, actor_id: actorId, role_name: 'DM', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 240 * 60000).toISOString() });
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== 冲突检测 =====
app.get('/api/schedules/conflicts/check', async (req: any, res: any) => {
  try {
    const { actorId, actorIds, roomId, date, startTime, endTime, excludeId } = req.query as any;
    const conflicts: any[] = [];
    const ids = String(actorIds || actorId || '')
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean);

    // 卡司冲突
    for (const id of ids) {
      let q = supabase
        .from('schedule_actors')
        .select('*, schedules!inner(id, tenant_id, scheduled_date, start_time, end_time, status, script_id, scripts!inner(name))')
        .eq('actor_id', id)
        .eq('schedules.tenant_id', TENANT_ID)
        .eq('schedules.scheduled_date', date)
        .not('schedules.status', 'eq', 'cancelled')
        .gt('schedules.end_time', startTime)
        .lt('schedules.start_time', endTime);
      if (excludeId) q = q.neq('schedules.id', excludeId);
      const { data: actorSchedules } = await q;
      if ((actorSchedules || []).length > 0) {
        for (const as of actorSchedules || []) {
          conflicts.push({ type: 'actor', id, scheduleId: as.schedules?.id, scriptName: as.schedules?.scripts?.name });
        }
      }
    }

    // 房间冲突
    if (roomId) {
      let q = supabase
        .from('schedules')
        .select('id, script_id, start_time, end_time, scripts!inner(name)')
        .eq('room_id', roomId)
        .eq('tenant_id', TENANT_ID)
        .eq('scheduled_date', date)
        .not('status', 'eq', 'cancelled')
        .gt('end_time', startTime)
        .lt('start_time', endTime);
      if (excludeId) q = q.neq('id', excludeId);
      const { data: roomSchedules } = await q;
      if (roomSchedules && (roomSchedules as any[]).length > 0) {
        for (const rs of roomSchedules as any[]) {
          conflicts.push({ type: 'room', id: roomId, scheduleId: rs.id, scriptName: rs.scripts?.name });
        }
      }
    }

    res.json(ok(conflicts));
  } catch (e) { res.status(500).json(err(e)); }
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
    const { data } = await supabase.from('checkins').insert({
      schedule_id: req.params.id, guest_name: name, guest_phone: phone ? hashPhone(phone) : null,
      role, guest_avatar: avatar || null
    }).select().single();
    // 满员自动确认
    const { data: sched } = await supabase.from('schedules').select('script_id').eq('id', req.params.id).single();
    let full = false;
    if (sched && data) {
      const { data: allRoles } = await supabase.from('script_player_roles').select('id').eq('script_id', sched.script_id);
      const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('schedule_id', req.params.id);
      if (allRoles && count !== null && count >= allRoles.length) {
        await supabase.from('schedules').update({ status: 'scheduled' }).eq('id', req.params.id);
        full = true;
      }
    }
    res.json(ok({ ...data, full }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/player/send-code', async (req: any, res: any) => {
  try {
    if (!isPhoneCodeLoginAvailable()) {
      return res.status(503).json(err(new Error('短信验证暂未启用，当前可使用手机号和昵称登录')));
    }
    const result = await createAndSendPhoneCode(req, 'player_login', req.body?.phone);
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/player/auth/config', async (_req: any, res: any) => {
  res.json(ok({
    smsEnabled: isPhoneCodeLoginAvailable(),
    smsRequired: isTencentSmsConfigured(),
    wechatEnabled: isWechatLoginConfigured(),
    legacyPhoneLoginEnabled: !isTencentSmsConfigured(),
  }));
});

app.post('/api/player/verify-code', async (req: any, res: any) => {
  try {
    const { phone, code } = req.body;
    const verifiedPhone = await verifyPhoneCode('player_login', phone, code);
    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', verifiedPhone).maybeSingle();
    if (existing) {
      await supabase.from('lc_profiles').update({ phone_verified_at: new Date().toISOString(), auth_provider: existing.auth_provider || 'phone' }).eq('id', existing.id);
      return res.json(ok({ id: existing.id, display_name: existing.display_name, phone: existing.phone, newUser: false }));
    }
    const { data: newPlayer } = await supabase.from('lc_profiles').insert({
      phone: verifiedPhone,
      display_name: `玩家${verifiedPhone.slice(-4)}`,
      role_type: 'player',
      phone_verified_at: new Date().toISOString(),
      auth_provider: 'phone',
    }).select().single();
    res.json(ok({ id: newPlayer!.id, display_name: newPlayer!.display_name, phone: verifiedPhone, newUser: true }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/player/wechat/url', async (req: any, res: any) => {
  try {
    if (!isWechatLoginConfigured()) return res.status(503).json(err(new Error('微信扫码登录尚未配置')));
    res.json(ok({ enabled: true, url: makeWechatAuthorizeUrl(safeFrontendRedirect(req.query.redirect)) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/player/wechat/start', async (req: any, res: any) => {
  try {
    if (!isWechatLoginConfigured()) return res.status(503).json(err(new Error('微信扫码登录尚未配置')));
    res.redirect(makeWechatAuthorizeUrl(safeFrontendRedirect(req.query.redirect)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/player/wechat/callback', async (req: any, res: any) => {
  try {
    if (!isWechatLoginConfigured()) throw new Error('微信扫码登录尚未配置');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) throw new Error('微信登录参数缺失');
    const statePayload = jwt.verify(state, JWT_SECRET) as { kind?: string; redirectPath?: string };
    if (statePayload.kind !== 'jzg_wechat_login') throw new Error('微信登录状态无效');

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.search = new URLSearchParams({
      appid: JZG_WECHAT_OPEN_APP_ID,
      secret: JZG_WECHAT_OPEN_APP_SECRET,
      code,
      grant_type: 'authorization_code',
    }).toString();
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json() as Record<string, any>;
    if (!tokenResp.ok || tokenData.errcode) throw new Error(String(tokenData.errmsg || '微信登录授权失败'));

    const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    userUrl.search = new URLSearchParams({
      access_token: String(tokenData.access_token),
      openid: String(tokenData.openid),
      lang: 'zh_CN',
    }).toString();
    const userResp = await fetch(userUrl);
    const wxUser = await userResp.json() as Record<string, any>;
    if (!userResp.ok || wxUser.errcode) throw new Error(String(wxUser.errmsg || '微信用户信息获取失败'));

    const openid = String(tokenData.openid || wxUser.openid || '');
    const unionid = tokenData.unionid || wxUser.unionid || null;
    if (!openid) throw new Error('微信登录缺少 openid');
    const nickname = typeof wxUser.nickname === 'string' && wxUser.nickname.trim() ? wxUser.nickname.trim().slice(0, 80) : `微信玩家${openid.slice(-4)}`;
    const avatar = typeof wxUser.headimgurl === 'string' ? wxUser.headimgurl : null;
    const nowIso = new Date().toISOString();

    let query = supabase.from('players').select('*').eq('tenant_id', TENANT_ID);
    if (unionid) query = query.eq('wechat_unionid', unionid);
    else query = query.eq('wechat_openid', openid);
    let { data: player } = await query.maybeSingle();

    if (player) {
      await supabase.from('players').update({
        display_name: player.display_name || nickname,
        auth_provider: player.auth_provider || 'wechat',
        wechat_openid: openid,
        wechat_unionid: unionid,
        wechat_nickname: nickname,
        wechat_avatar: avatar,
        wechat_bound_at: nowIso,
      }).eq('id', player.id);
    } else {
      const inserted = await supabase.from('players').insert({
        tenant_id: TENANT_ID,
        display_name: nickname,
        name_encrypted: nickname,
        auth_provider: 'wechat',
        wechat_openid: openid,
        wechat_unionid: unionid,
        wechat_nickname: nickname,
        wechat_avatar: avatar,
        wechat_bound_at: nowIso,
      }).select().single();
      if (!inserted.data) throw inserted.error || new Error('微信登录创建玩家失败');
      player = inserted.data;
    }

    const loginToken = jwt.sign({ role: 'player', playerId: player.id, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
    const payload = Buffer.from(JSON.stringify({
      token: loginToken,
      player: {
        id: player.id,
        displayName: player.display_name || nickname,
        phone: '',
        totalGames: player.total_games || 0,
        authProvider: 'wechat',
      },
    })).toString('base64url');
    const redirectPath = safeFrontendRedirect(statePayload.redirectPath);
    res.redirect(`${JUZHANGGUI_SITE_URL}/player/login?wechat_login=${encodeURIComponent(payload)}&redirect=${encodeURIComponent(redirectPath)}`);
  } catch (e) {
    res.redirect(`${JUZHANGGUI_SITE_URL}/player/login?auth_error=${encodeURIComponent(err(e).error || '微信登录失败')}`);
  }
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
  try { const { data } = await supabase.from('customers').select('*').eq('tenant_id', TENANT_ID).order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/customers/search', async (req: any, res: any) => {
  try {
    const q = req.query.q || '';
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', TENANT_ID).or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order('name').limit(20);
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/customers', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('customers').insert({ name: req.body.name, phone: req.body.phone || null, membership_level: req.body.membershipLevel || 'none', balance: req.body.balance || 0, tenant_id: TENANT_ID }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').update(req.body).eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').delete().eq('id', req.params.id).eq('tenant_id', TENANT_ID); res.json(ok()); }
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
    const { phone, displayName, code } = req.body;
    if (!displayName) return res.status(400).json(err(new Error('请填写昵称')));
    const hasCode = typeof code === 'string' && code.trim().length > 0;
    if (isTencentSmsConfigured() && !hasCode) return res.status(400).json(err(new Error('请先获取并填写短信验证码')));
    const verifiedPhone = hasCode ? await verifyPhoneCode('player_login', phone, code) : normalizeChinaPhone(phone);
    const phoneHash = hashPhone(verifiedPhone);
    let { data: p } = await supabase.from('players').select('*').eq('phone_hash', phoneHash).eq('tenant_id', TENANT_ID).maybeSingle();
    const nowIso = new Date().toISOString();
    if (p) {
      const updatePayload: Record<string, any> = { display_name: displayName.trim() };
      if (hasCode) {
        updatePayload.auth_provider = p.auth_provider || 'phone';
        updatePayload.phone_verified_at = p.phone_verified_at || nowIso;
      }
      await supabase.from('players').update(updatePayload).eq('id', p.id);
      p = { ...p, ...updatePayload };
    }
    else {
      const insertPayload: Record<string, any> = {
        phone_hash: phoneHash,
        display_name: displayName.trim(),
        name_encrypted: displayName.trim(),
        tenant_id: TENANT_ID,
      };
      if (hasCode) {
        insertPayload.auth_provider = 'phone';
        insertPayload.phone_verified_at = nowIso;
      }
      const r = await supabase.from('players').insert(insertPayload).select().single();
      p = r.data;
    }
    const token = jwt.sign({ role: 'player', playerId: p!.id, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({ token, player: { id: p!.id, displayName: p!.display_name, phone: verifiedPhone, totalGames: p!.total_games || 0 } }));
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
