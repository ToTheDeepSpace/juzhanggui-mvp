// Vercel Serverless 入口 — 自包含，由 @vercel/node 编译
// 所有路由内联在此文件

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(`juzhanggui:${phone.trim()}`).digest('hex');
}

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
const SUPER_ADMIN_EMAIL = 'hnnkkk@qq.com';

const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('⚠ JWT_SECRET env is not set — using fallback. Set it in Vercel dev dashboard!');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
const PLAYER_LOGIN_CODE = process.env.PLAYER_LOGIN_CODE || (process.env.NODE_ENV === 'production' ? '' : '8888');
const AUTH_CODE_PEPPER = process.env.AUTH_CODE_PEPPER || JWT_SECRET;
const SMS_CODE_TTL_MINUTES = Number(process.env.SMS_CODE_TTL_MINUTES || 5);
const SMS_CODE_COOLDOWN_SECONDS = Number(process.env.SMS_CODE_COOLDOWN_SECONDS || 60);
const EMAIL_CODE_TTL_MINUTES = Number(process.env.EMAIL_CODE_TTL_MINUTES || 10);
const EMAIL_CODE_COOLDOWN_SECONDS = Number(process.env.EMAIL_CODE_COOLDOWN_SECONDS || 60);
const TENCENT_SMS_REGION = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';
const TENCENT_SMS_SDK_APP_ID = process.env.TENCENT_SMS_SDK_APP_ID || '';
const TENCENT_SMS_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME || '';
const TENCENT_SMS_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID || '';
const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || '';
const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || '';
const TENCENT_SES_REGION = process.env.TENCENT_SES_REGION || 'ap-hongkong';
const TENCENT_SES_FROM_EMAIL = process.env.TENCENT_SES_FROM_EMAIL || 'no-reply@mail.jusichen.com';
const TENCENT_SES_FROM_NAME = process.env.TENCENT_SES_FROM_NAME || '剧司辰';
const TENCENT_SES_REPLY_TO = process.env.TENCENT_SES_REPLY_TO || 'basara-twenty@foxmail.com';
const TENCENT_SES_TEMPLATE_ID = process.env.TENCENT_SES_TEMPLATE_ID || '';
const TENCENT_SES_ALLOW_SIMPLE = process.env.TENCENT_SES_ALLOW_SIMPLE === 'true';
const JUZHANGGUI_SITE_URL = (process.env.JUZHANGGUI_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://jusichen.com').replace(/\/$/, '');
const LINGQI_SITE_URL = (process.env.LINGQI_SITE_URL || process.env.VITE_LINGQI_SITE_URL || 'https://lingqi.jusichen.com').replace(/\/$/, '');
const JZG_WECHAT_OPEN_APP_ID = process.env.JZG_WECHAT_OPEN_APP_ID || process.env.WECHAT_OPEN_APP_ID || '';
const JZG_WECHAT_OPEN_APP_SECRET = process.env.JZG_WECHAT_OPEN_APP_SECRET || process.env.WECHAT_OPEN_APP_SECRET || '';
const JZG_WECHAT_REDIRECT_URI = process.env.JZG_WECHAT_REDIRECT_URI || `${JUZHANGGUI_SITE_URL}/api/player/wechat/callback`;

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/config',
  '/api/auth/send-code',
  '/api/auth/email/send-code',
  '/api/auth/email-login',
  '/api/auth/password/reset',
  '/api/auth/register',
  '/api/auth/phone-login',
  '/api/player/auth/config',
  '/api/player/login',
  '/api/player/send-code',
  '/api/player/verify-code',
  '/api/player/wechat/url',
  '/api/player/wechat/start',
  '/api/player/wechat/callback',
  '/api/dm/auth/config',
  '/api/dm/login',
  '/api/dm/send-code',
];
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
    const isPlayerApi = req.path.startsWith('/api/player/');
    const isDmApi = req.path.startsWith('/api/dm/');
    if (isPlayerApi && decoded.role !== 'player' && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无玩家权限' });
    }
    if (isDmApi && decoded.role !== 'dm' && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无 DM 权限' });
    }
    if (!isPlayerApi && !isDmApi && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无管理员权限' });
    }
    next();
  }
  catch { res.status(401).json({ success: false, error: '登录已过期' }); }
});

function ok(d?: any) { return { success: true, data: d }; }
function err(e: any) { return { success: false, error: e?.message || String(e) }; }
function sha256(input: string): string { return crypto.createHash('sha256').update(input).digest('hex'); }
function cleanText(input: unknown, max = 120): string {
  return typeof input === 'string' ? input.trim().slice(0, max) : '';
}
function currentTenantId(req: any): string {
  return cleanText(req?.user?.tenantId, 80) || TENANT_ID;
}
function currentAdminRole(req: any): string {
  return cleanText(req?.user?.adminRole || req?.user?.roleName || '', 40);
}
function isSuperAdminReq(req: any): boolean {
  return currentAdminRole(req) === 'super_admin' || cleanText(req?.user?.email, 160).toLowerCase() === SUPER_ADMIN_EMAIL;
}
function requireSuperAdmin(req: any, res: any): boolean {
  if (isSuperAdminReq(req)) return true;
  res.status(403).json(err(new Error('需要超级管理员权限')));
  return false;
}
function normalizeProfilePhone(input: unknown): string {
  const digits = typeof input === 'string' ? input.replace(/\D/g, '') : '';
  return /^1[3-9]\d{9}$/.test(digits) ? digits : '';
}
function normalizeClockTime(input: unknown, fallback = '19:30') {
  const raw = cleanText(input, 20);
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function normalizeIdentityRoles(profile: any, additions: string[]) {
  const roles: string[] = [];
  const push = (value: unknown) => {
    const role = cleanText(value, 40).toLowerCase();
    if (role && !roles.includes(role)) roles.push(role);
  };
  if (Array.isArray(profile?.identity_roles)) profile.identity_roles.forEach(push);
  push(profile?.role_type);
  push(profile?.role);
  if (profile?.verified_dm) push('dm');
  if (profile?.verified_shop) push('shop');
  additions.forEach(push);
  return roles.length ? roles : ['player'];
}
function preferredRoleType(profile: any, additions: string[]) {
  const existing = cleanText(profile?.role_type, 40).toLowerCase();
  if (existing && existing !== 'player') return existing;
  return additions[0] || existing || 'player';
}
function normalizeChinaPhone(input: unknown): string {
  const phone = typeof input === 'string' ? input.replace(/\D/g, '') : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请填写正确的中国大陆手机号');
  return phone;
}
function normalizeEmail(input: unknown): string {
  const email = cleanText(input, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请填写正确的邮箱');
  return email;
}
function makeAuthPhoneHash(phone: string) { return sha256(`auth-phone:${phone}`); }
function makeAuthCodeHash(phone: string, code: string) { return sha256(`auth-code:${AUTH_CODE_PEPPER}:${phone}:${code}`); }
function makeAuthEmailHash(email: string) { return sha256(`auth-email:${email.toLowerCase()}`); }
function makeAuthEmailCodeHash(email: string, code: string) { return sha256(`auth-email-code:${AUTH_CODE_PEPPER}:${email.toLowerCase()}:${code}`); }
function makeSmsCode() {
  if (process.env.NODE_ENV !== 'production' && PLAYER_LOGIN_CODE) return PLAYER_LOGIN_CODE;
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function makeEmailCode() {
  if (process.env.NODE_ENV !== 'production' && PLAYER_LOGIN_CODE) return PLAYER_LOGIN_CODE;
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  const left = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${left}@${domain}`;
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
function isTencentEmailConfigured() {
  return Boolean(
    TENCENTCLOUD_SECRET_ID &&
    TENCENTCLOUD_SECRET_KEY &&
    TENCENT_SES_FROM_EMAIL &&
    (TENCENT_SES_TEMPLATE_ID || TENCENT_SES_ALLOW_SIMPLE)
  );
}
function isPhoneCodeLoginAvailable() {
  return isTencentSmsConfigured() || process.env.NODE_ENV !== 'production';
}
function isEmailCodeLoginAvailable() {
  return isTencentEmailConfigured() || process.env.NODE_ENV !== 'production';
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

function scheduleRelation(row: any) {
  return Array.isArray(row?.schedules) ? row.schedules[0] : row?.schedules;
}

function relationName(row: any, key: string) {
  const relation = row?.[key];
  if (Array.isArray(relation)) return cleanText(relation[0]?.name, 100);
  return cleanText(relation?.name, 100);
}

function combineScheduleDateTime(schedule: any, field: 'start_time' | 'end_time') {
  const raw = cleanText(schedule?.[field], 40);
  if (raw.includes('T')) return raw;
  const date = cleanText(schedule?.scheduled_date, 20) || new Date().toISOString().slice(0, 10);
  return `${date}T${normalizeClockTime(raw, field === 'start_time' ? '19:30' : '23:30')}`;
}

function statusText(status: unknown) {
  const value = cleanText(status, 30);
  const map: Record<string, string> = {
    pending: '待确认',
    scheduled: '已排班',
    confirmed: '已确认',
    locked: '已锁定',
    ongoing: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    bombed: '已炸车',
  };
  return map[value] || value || '未设置';
}

function isClosedSchedule(status: unknown) {
  return ['cancelled', 'bombed'].includes(cleanText(status, 30));
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function uniqueTexts(values: unknown[], max = 20) {
  const result: string[] = [];
  for (const value of values) {
    const text = cleanText(value, 80);
    if (text && !result.includes(text)) result.push(text);
    if (result.length >= max) break;
  }
  return result;
}

function isMissingRelationError(error: any, relation: string) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return error?.code === '42P01' || text.includes(relation);
}

function dmRatingLevel(score: number) {
  if (score >= 90) return '王牌 DM';
  if (score >= 82) return '金牌 DM';
  if (score >= 72) return '成熟 DM';
  if (score >= 60) return '成长中';
  return '待积累';
}

async function findActorByPhone(phone: string) {
  const { data, error } = await supabase.from('actors')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('name');
  if (error) throw error;
  return (data || []).find((actor: any) => normalizeProfilePhone(actor.phone) === phone) || null;
}

async function ensureLingqiDmProfileForActor(actor: { name?: unknown; phone?: unknown }) {
  const phone = normalizeProfilePhone(actor.phone);
  if (!phone) return null;

  const displayName = cleanText(actor.name, 80) || `DM${phone.slice(-4)}`;
  const { data: existing, error: queryErr } = await supabase.from('lc_profiles')
    .select('id, display_name, role, role_type, identity_roles, verified_dm, verified_shop')
    .eq('phone', phone)
    .maybeSingle();
  if (queryErr) throw queryErr;

  if (existing) {
    const patch: Record<string, unknown> = {
      verified_dm: true,
      identity_roles: normalizeIdentityRoles(existing, ['dm']),
      role_type: preferredRoleType(existing, ['dm']),
      updated_at: new Date().toISOString(),
    };
    if (!existing.display_name) patch.display_name = displayName;
    const { data: updated, error: updErr } = await supabase.from('lc_profiles')
      .update(patch)
      .eq('id', existing.id)
      .select('id, display_name, role_type, identity_roles, verified_dm')
      .maybeSingle();
    if (updErr) throw updErr;
    return updated || { ...existing, ...patch };
  }

  const { data: created, error: insErr } = await supabase.from('lc_profiles').insert({
    phone,
    display_name: displayName,
    role: 'player',
    role_type: 'dm',
    identity_roles: ['dm'],
    verified_dm: true,
    is_visible: true,
    auth_provider: 'juzhanggui_actor',
    balance: 0,
  }).select('id, display_name, role_type, identity_roles, verified_dm').single();
  if (insErr) throw insErr;
  return created;
}

function extractLineValue(text: unknown, label: string) {
  const raw = cleanText(text, 2000);
  const match = raw.match(new RegExp(`${label}[：:]\\s*([^\\n]+)`));
  return match ? cleanText(match[1], 120) : '';
}

function shouldSyncScheduleToLingqiCarpool(schedule: any) {
  const text = `${schedule?.customer_name || ''}\n${schedule?.note || ''}`;
  if (/来源[：:]\s*灵契拼车区|拼车ID[：:]/.test(text)) return false;
  return /(拼车|车头|缺人|缺位|车位|组局|上车)/.test(text);
}

async function ensureJuzhangguiSyncProfile() {
  const phone = '__juzhanggui_sync__';
  const { data: existing, error: queryErr } = await supabase.from('lc_profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (queryErr) throw queryErr;
  if (existing?.id) return existing.id;

  const { data, error: insErr } = await supabase.from('lc_profiles').insert({
    phone,
    display_name: '剧司辰店家同步',
    role: 'shop',
    role_type: 'shop',
    identity_roles: ['shop'],
    verified_shop: true,
    is_visible: false,
    balance: 0,
    auth_provider: 'juzhanggui_sync',
  }).select('id').single();
  if (insErr) throw insErr;
  return data.id;
}

async function syncScheduleToLingqiCarpool(scheduleId: string, tenantId = TENANT_ID) {
  const { data: schedule, error: scheduleErr } = await supabase.from('schedules')
    .select('*, scripts(id, name), rooms(id, name)')
    .eq('id', scheduleId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (scheduleErr) throw scheduleErr;
  if (!schedule) return { ok: false, skipped: true, reason: 'schedule_not_found' };

  const { data: existingCarpool, error: carpoolQueryErr } = await supabase.from('lc_carpools')
    .select('id, status')
    .eq('juzhanggui_schedule_id', schedule.id)
    .maybeSingle();
  if (carpoolQueryErr) throw carpoolQueryErr;

  if (!existingCarpool && !shouldSyncScheduleToLingqiCarpool(schedule)) {
    return { ok: true, skipped: true, reason: 'not_carpool' };
  }

  const { data: roleRows, error: roleErr } = await supabase.from('script_player_roles')
    .select('role_name, gender, tags')
    .eq('script_id', schedule.script_id);
  if (roleErr) throw roleErr;
  const { data: checkins, error: checkinErr } = await supabase.from('checkins')
    .select('role, guest_name')
    .eq('schedule_id', schedule.id);
  if (checkinErr) throw checkinErr;

  const seatedByRole = new Map<string, any>();
  for (const item of checkins || []) {
    const role = cleanText(item.role, 80);
    if (role) seatedByRole.set(role, item);
  }
  const scriptRoles = (roleRows || []).map((role: any) => {
    const roleName = cleanText(role.role_name, 80);
    const seated = seatedByRole.get(roleName);
    return {
      role_name: roleName,
      gender: cleanText(role.gender, 20) || null,
      tags: Array.isArray(role.tags) ? role.tags : [],
      status: seated ? 'seated' : 'needed',
      player_name: seated ? cleanText(seated.guest_name, 60) || null : null,
      player_gender: null,
    };
  }).filter((role: any) => role.role_name);

  const seatedRoles = scriptRoles.filter((role: any) => role.status === 'seated');
  const neededRoles = scriptRoles.filter((role: any) => role.status !== 'seated');
  const scriptName = cleanText(schedule.scripts?.name, 100) || '未命名剧本';
  const city = extractLineValue(schedule.note, '城市') || '待定城市';
  const roomName = cleanText(schedule.rooms?.name, 100);
  const posterId = await ensureJuzhangguiSyncProfile();
  const startTime = normalizeClockTime(schedule.start_time, '19:30');
  const deadlineDate = schedule.scheduled_date || new Date().toISOString().slice(0, 10);
  const status = schedule.status === 'cancelled' || schedule.status === 'bombed' ? 'closed' : 'approved';
  const roleName = neededRoles.map((role: any) => role.role_name).join('、') || cleanText(schedule.note, 80) || '待定角色';
  const contentLines = [
    '来源：剧司辰店家排期',
    `排期ID：${schedule.id}`,
    schedule.customer_name ? `车头/客户：${schedule.customer_name}` : '',
    schedule.customer_phone ? `联系方式：${schedule.customer_phone}` : '',
    schedule.note ? `备注：${schedule.note}` : '',
  ].filter(Boolean);

  const payload = {
    poster_id: posterId,
    poster_name: '剧司辰店家同步',
    poster_is_realname: true,
    title: `${schedule.scheduled_date || ''} · ${city} · ${scriptName}`.replace(/^[ ·]+/, ''),
    city,
    event_date: schedule.scheduled_date,
    start_time: startTime,
    deadline_date: deadlineDate,
    deadline_time: null,
    script_id: schedule.script_id || null,
    script_name: scriptName,
    role_name: roleName,
    role_note: [
      seatedRoles.length ? `已上车：${seatedRoles.map((role: any) => role.role_name).join('、')}` : '',
      neededRoles.length ? `缺人：${neededRoles.map((role: any) => role.role_name).join('、')}` : '',
    ].filter(Boolean).join('；') || null,
    script_roles: scriptRoles,
    seated_roles: seatedRoles,
    store_name: roomName || null,
    store_city: city,
    store_address: null,
    store_source_url: null,
    store_verify_note: '来自剧司辰店家后台排期',
    store_suggestion_status: roomName ? 'pending' : 'none',
    subsidy_mode: 'none',
    subsidy_type: 'none',
    subsidy_amount: 0,
    subsidy_discount: null,
    subsidy_note: null,
    needed_count: Math.min(20, Math.max(1, neededRoles.length || Number(schedule.player_count || 0) || 1)),
    joined_count: seatedRoles.length || (checkins || []).length,
    leader_contact: cleanText(schedule.customer_phone, 120) || null,
    contact_note: '联系方式来自剧司辰排期，实际公开范围以后台设置为准。',
    content: contentLines.join('\n').slice(0, 1600),
    boost_amount: 0,
    status,
    juzhanggui_sync_status: 'synced',
    juzhanggui_schedule_id: schedule.id,
    source_project: 'juzhanggui',
    ai_assist_context: {
      source: 'juzhanggui_schedule',
      schedule_status: schedule.status,
      tenant_id: tenantId,
      synced_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  if (existingCarpool?.id) {
    const { error: updErr } = await supabase.from('lc_carpools')
      .update(payload)
      .eq('id', existingCarpool.id);
    if (updErr) throw updErr;
    return { ok: true, carpoolId: existingCarpool.id, updated: true };
  }

  const { data: inserted, error: insErr } = await supabase.from('lc_carpools')
    .insert(payload)
    .select('id')
    .single();
  if (insErr) throw insErr;
  return { ok: true, carpoolId: inserted?.id || null, updated: false };
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

async function sendTencentEmailCode(email: string, code: string) {
  if (!isTencentEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('邮箱验证码服务未配置');
    console.log(`[邮箱验证码][dev] 发送到 ${email}: ${code}`);
    return { provider: 'dev-log' };
  }

  const imported = await import('tencentcloud-sdk-nodejs');
  const tencentcloud = (imported as unknown as { default?: any }).default || imported as any;
  const SesClient = tencentcloud.ses.v20201002.Client;
  const client = new SesClient({
    credential: { secretId: TENCENTCLOUD_SECRET_ID, secretKey: TENCENTCLOUD_SECRET_KEY },
    region: TENCENT_SES_REGION,
    profile: { httpProfile: { endpoint: 'ses.tencentcloudapi.com', reqMethod: 'POST', reqTimeout: 10 } },
  });

  const params: Record<string, any> = {
    FromEmailAddress: TENCENT_SES_FROM_EMAIL,
    ReplyToAddresses: TENCENT_SES_REPLY_TO,
    Destination: [email],
    Subject: '剧司辰邮箱验证码',
    TriggerType: 1,
  };

  if (TENCENT_SES_TEMPLATE_ID) {
    params.Template = {
      TemplateID: Number(TENCENT_SES_TEMPLATE_ID),
      TemplateData: JSON.stringify({
        code,
        ttl: String(EMAIL_CODE_TTL_MINUTES),
        product: '剧司辰',
      }),
    };
  } else {
    const text = `您的剧司辰验证码是：${code}。${EMAIL_CODE_TTL_MINUTES} 分钟内有效。若非本人操作，请忽略本邮件。`;
    const html = `<html><body><p>您的剧司辰验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>${EMAIL_CODE_TTL_MINUTES} 分钟内有效。若非本人操作，请忽略本邮件。</p></body></html>`;
    params.Simple = {
      Text: Buffer.from(text, 'utf8').toString('base64'),
      Html: Buffer.from(html, 'utf8').toString('base64'),
    };
  }

  const response = await client.SendEmail(params);
  return { provider: 'tencentcloud-ses', messageId: response?.MessageId || null };
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

async function createAndSendEmailCode(req: any, purpose: string, rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!['admin_register', 'admin_login', 'admin_reset_password'].includes(purpose)) throw new Error('邮箱验证码用途无效');

  const existing = await getAdminUserByEmail(email);
  if (purpose === 'admin_register' && existing) throw new Error('这个邮箱已经注册，请直接登录');
  if (['admin_login', 'admin_reset_password'].includes(purpose) && !existing) throw new Error('这个邮箱还没有注册，请先注册账号');
  if (['admin_login', 'admin_reset_password'].includes(purpose) && existing?.status !== 'active') throw new Error('这个后台账号已停用');

  const emailHash = makeAuthEmailHash(email);
  const { data: latest, error: latestErr } = await supabase.from('jzg_email_verification_codes')
    .select('id, created_at')
    .eq('purpose', purpose)
    .eq('email_hash', emailHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  if (latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < EMAIL_CODE_COOLDOWN_SECONDS * 1000) {
    throw new Error(`验证码已发送，请 ${EMAIL_CODE_COOLDOWN_SECONDS} 秒后再试`);
  }

  const code = makeEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const domain = email.split('@')[1] || '';
  const { data: row, error: insertErr } = await supabase.from('jzg_email_verification_codes').insert({
    purpose,
    email_hash: emailHash,
    email_mask: maskEmail(email),
    email_domain: domain,
    code_hash: makeAuthEmailCodeHash(email, code),
    ip_address: getClientIp(req),
    user_agent: getUserAgent(req),
    expires_at: expiresAt,
  }).select('id').single();
  if (insertErr) throw insertErr;
  try {
    const sent = await sendTencentEmailCode(email, code);
    return { email, expiresAt, provider: sent.provider };
  } catch (sendErr) {
    if (row?.id) await supabase.from('jzg_email_verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
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

async function verifyEmailCode(purpose: string, rawEmail: unknown, rawCode: unknown) {
  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : '';
  if (!/^\d{4,8}$/.test(code)) throw new Error('请填写正确的邮箱验证码');
  const { data: row, error: qErr } = await supabase.from('jzg_email_verification_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('purpose', purpose)
    .eq('email_hash', makeAuthEmailHash(email))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row) throw new Error('请先获取邮箱验证码');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('邮箱验证码已过期，请重新获取');
  if ((row.attempts || 0) >= 5) throw new Error('邮箱验证码错误次数过多，请重新获取');
  if (row.code_hash !== makeAuthEmailCodeHash(email, code)) {
    await supabase.from('jzg_email_verification_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
    throw new Error('邮箱验证码错误');
  }
  await supabase.from('jzg_email_verification_codes').update({ attempts: (row.attempts || 0) + 1, consumed_at: new Date().toISOString() }).eq('id', row.id);
  return email;
}

function publicAdminUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    phone: user.phone || '',
    displayName: user.display_name || '店家管理员',
    role: user.role || 'store_admin',
    tenantId: user.tenant_id || TENANT_ID,
    storeId: user.store_id || null,
    phoneVerified: !!user.phone_verified_at,
    emailVerified: !!user.email_verified_at,
    authProvider: user.auth_provider || null,
  };
}
function makeAdminToken(user?: any) {
  const adminRole = user?.role || 'store_admin';
  const payload: Record<string, any> = {
    role: 'admin',
    adminRole,
    tenantId: user?.tenant_id || TENANT_ID,
  };
  if (user?.id) payload.adminUserId = user.id;
  if (user?.store_id) payload.storeId = user.store_id;
  if (user?.email) payload.email = user.email;
  if (user?.phone) payload.phone = user.phone;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
async function getAdminUserById(id: unknown) {
  const adminUserId = cleanText(id, 80);
  if (!adminUserId) return null;
  const { data, error } = await supabase.from('jzg_admin_users')
    .select('*')
    .eq('id', adminUserId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
async function getAdminUserByEmail(email: string) {
  const { data, error } = await supabase.from('jzg_admin_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
async function getAdminUserByPhone(phone: string) {
  const { data, error } = await supabase.from('jzg_admin_users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
async function touchAdminLogin(userId: string, provider: string) {
  await supabase.from('jzg_admin_users')
    .update({ last_login_at: new Date().toISOString(), auth_provider: provider, updated_at: new Date().toISOString() })
    .eq('id', userId);
}
async function logPlatformAction(req: any, action: string, target?: { type?: string; id?: unknown; label?: unknown }, detail?: Record<string, any>) {
  try {
    const actor = await getAdminUserById(req.user?.adminUserId);
    await supabase.from('jzg_platform_audit_logs').insert({
      actor_admin_user_id: actor?.id || null,
      actor_email: actor?.email || req.user?.email || null,
      actor_role: actor?.role || req.user?.adminRole || null,
      action,
      target_type: target?.type || null,
      target_id: target?.id ? String(target.id) : null,
      target_label: target?.label ? String(target.label) : null,
      detail: detail || {},
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });
  } catch (logErr) {
    console.warn('[platform-audit-log-failed]', err(logErr).error);
  }
}
async function getStoreMapByIds(ids: unknown[]) {
  const uniqueIds = Array.from(new Set(ids.map(id => cleanText(id, 80)).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase.from('jzg_stores')
    .select('id,name,city,status')
    .in('id', uniqueIds);
  if (error) throw error;
  return new Map((data || []).map((store: any) => [store.id, store]));
}
async function createStoreForAdminAccount(name: string, city?: string | null, contact?: string | null) {
  const storeName = cleanText(name, 120) || '新店家';
  const { data, error } = await supabase.from('jzg_stores').insert({
    name: storeName,
    city: cleanText(city, 80) || null,
    contact: cleanText(contact, 120) || null,
    status: 'active',
  }).select('*').single();
  if (error) throw error;
  return data;
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
app.get('/api/auth/config', async (_req: any, res: any) => {
  res.json(ok({
    emailEnabled: true,
    emailCodeEnabled: isEmailCodeLoginAvailable(),
    emailCodeRequired: isTencentEmailConfigured(),
    phoneEnabled: true,
    smsEnabled: isPhoneCodeLoginAvailable(),
    smsRequired: isTencentSmsConfigured(),
    legacyPasswordEnabled: false,
  }));
});

app.post('/api/auth/send-code', async (req: any, res: any) => {
  try {
    if (!isPhoneCodeLoginAvailable()) {
      return res.status(503).json(err(new Error('短信验证暂未启用')));
    }
    const result = await createAndSendPhoneCode(req, 'admin_login', req.body?.phone);
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/email/send-code', async (req: any, res: any) => {
  try {
    if (!isEmailCodeLoginAvailable()) {
      return res.status(503).json(err(new Error('邮箱验证码暂未启用')));
    }
    const purpose = cleanText(req.body?.purpose, 40) || 'admin_login';
    const result = await createAndSendEmailCode(req, purpose, req.body?.email);
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/register', async (req: any, res: any) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = cleanText(req.body?.password, 120);
    const displayName = cleanText(req.body?.displayName, 80) || '店家管理员';
    if (password.length < 8) return res.status(400).json(err(new Error('密码至少 8 位')));
    if (email === SUPER_ADMIN_EMAIL) return res.status(403).json(err(new Error('超级管理员邮箱请使用旧管理密码登录完成升级')));

    const existingEmail = await getAdminUserByEmail(email);
    if (existingEmail) return res.status(409).json(err(new Error('这个邮箱已经注册，请直接登录')));

    await verifyEmailCode('admin_register', email, req.body?.emailCode || req.body?.code);

    let verifiedPhone = '';
    if (cleanText(req.body?.phone, 30) || cleanText(req.body?.phoneCode, 12)) {
      verifiedPhone = await verifyPhoneCode('admin_login', req.body?.phone, req.body?.phoneCode);
      const existingPhone = await getAdminUserByPhone(verifiedPhone);
      if (existingPhone) return res.status(409).json(err(new Error('这个手机号已经绑定后台账号，请用手机号登录')));
    }

    const store = await createStoreForAdminAccount(cleanText(req.body?.storeName, 120) || displayName || email.split('@')[0], null, verifiedPhone || null);
    const { data, error } = await supabase.from('jzg_admin_users').insert({
      tenant_id: store.id,
      store_id: store.id,
      email,
      phone: verifiedPhone || null,
      display_name: displayName,
      password_hash: await bcrypt.hash(password, 10),
      role: 'store_admin',
      status: 'active',
      email_verified_at: new Date().toISOString(),
      phone_verified_at: verifiedPhone ? new Date().toISOString() : null,
      auth_provider: verifiedPhone ? 'email_phone' : 'email',
      last_login_at: new Date().toISOString(),
    }).select('*').single();
    if (error) throw error;
    res.json(ok({ token: makeAdminToken(data), user: publicAdminUser(data) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/email-login', async (req: any, res: any) => {
  try {
    const email = await verifyEmailCode('admin_login', req.body?.email, req.body?.code);
    let user = await getAdminUserByEmail(email);
    if (!user || user.status !== 'active') return res.status(401).json(err(new Error('这个邮箱还没有可用的后台账号')));
    if (email === SUPER_ADMIN_EMAIL && user.role !== 'super_admin') {
      const { data: upgraded, error: upgradeErr } = await supabase.from('jzg_admin_users').update({
        role: 'super_admin',
        display_name: user.display_name || '超级管理员',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).select('*').single();
      if (upgradeErr) throw upgradeErr;
      user = upgraded;
    }
    await supabase.from('jzg_admin_users').update({
      email_verified_at: user.email_verified_at || new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      auth_provider: 'email_code',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    const refreshed = { ...user, email_verified_at: user.email_verified_at || new Date().toISOString(), auth_provider: 'email_code' };
    res.json(ok({ token: makeAdminToken(refreshed), user: publicAdminUser(refreshed) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/password/reset', async (req: any, res: any) => {
  try {
    const email = await verifyEmailCode('admin_reset_password', req.body?.email, req.body?.code);
    const newPassword = cleanText(req.body?.password || req.body?.newPassword, 120);
    if (newPassword.length < 8) return res.status(400).json(err(new Error('新密码至少 8 位')));

    let user = await getAdminUserByEmail(email);
    if (!user || user.status !== 'active') return res.status(401).json(err(new Error('这个邮箱还没有可用的后台账号')));
    if (user.password_hash && await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json(err(new Error('新密码不能和原密码相同')));
    }
    if (email === SUPER_ADMIN_EMAIL && user.role !== 'super_admin') {
      const { data: upgraded, error: upgradeErr } = await supabase.from('jzg_admin_users').update({
        role: 'super_admin',
        display_name: user.display_name || '超级管理员',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).select('*').single();
      if (upgradeErr) throw upgradeErr;
      user = upgraded;
    }
    const { data: updated, error: updateErr } = await supabase.from('jzg_admin_users').update({
      password_hash: await bcrypt.hash(newPassword, 10),
      email_verified_at: user.email_verified_at || new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      auth_provider: 'password_reset',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id).select('*').single();
    if (updateErr) throw updateErr;
    res.json(ok({ token: makeAdminToken(updated), user: publicAdminUser(updated) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    if (email) {
      const normalizedEmail = normalizeEmail(email);
      let user = await getAdminUserByEmail(normalizedEmail);
      const rawPassword = cleanText(password, 120);
      if (!user && normalizedEmail === 'hnnkkk@qq.com' && ADMIN_PASSWORD && rawPassword === ADMIN_PASSWORD) {
        const { data: created, error: createErr } = await supabase.from('jzg_admin_users').insert({
          tenant_id: TENANT_ID,
          email: normalizedEmail,
          display_name: '超级管理员',
          password_hash: await bcrypt.hash(rawPassword, 10),
          role: 'super_admin',
          status: 'active',
          email_verified_at: new Date().toISOString(),
          auth_provider: 'legacy_password_upgrade',
          last_login_at: new Date().toISOString(),
        }).select('*').single();
        if (createErr) throw createErr;
        user = created;
      }
      if (!user || user.status !== 'active' || !user.password_hash) {
        return res.status(401).json(err(new Error('邮箱或密码错误')));
      }
      const matched = await bcrypt.compare(rawPassword, user.password_hash);
      if (!matched) return res.status(401).json(err(new Error('邮箱或密码错误')));
      if (normalizedEmail === SUPER_ADMIN_EMAIL && user.role !== 'super_admin') {
        const { data: upgraded, error: upgradeErr } = await supabase.from('jzg_admin_users').update({
          role: 'super_admin',
          display_name: user.display_name || '超级管理员',
          updated_at: new Date().toISOString(),
        }).eq('id', user.id).select('*').single();
        if (upgradeErr) throw upgradeErr;
        user = upgraded;
      }
      await touchAdminLogin(user.id, 'email');
      const refreshed = { ...user, last_login_at: new Date().toISOString(), auth_provider: 'email' };
      return res.json(ok({ token: makeAdminToken(refreshed), user: publicAdminUser(refreshed) }));
    }

    res.status(400).json(err(new Error('请使用邮箱或手机号登录')));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/phone-login', async (req: any, res: any) => {
  try {
    const verifiedPhone = await verifyPhoneCode('admin_login', req.body?.phone, req.body?.code);
    let user = await getAdminUserByPhone(verifiedPhone);
    if (user && user.status !== 'active') return res.status(403).json(err(new Error('这个后台账号已停用')));
    if (!user) {
      const store = await createStoreForAdminAccount(`店家${verifiedPhone.slice(-4)}`, null, verifiedPhone);
      const { data, error } = await supabase.from('jzg_admin_users').insert({
        tenant_id: store.id,
        store_id: store.id,
        phone: verifiedPhone,
        display_name: `店家${verifiedPhone.slice(-4)}`,
        role: 'store_admin',
        status: 'active',
        phone_verified_at: new Date().toISOString(),
        auth_provider: 'phone',
        last_login_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      user = data;
    } else {
      await supabase.from('jzg_admin_users').update({
        phone_verified_at: user.phone_verified_at || new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        auth_provider: 'phone',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      user = { ...user, phone_verified_at: user.phone_verified_at || new Date().toISOString(), auth_provider: 'phone' };
    }
    res.json(ok({ token: makeAdminToken(user), user: publicAdminUser(user) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/auth/me', async (req: any, res: any) => {
  try {
    const user = await getAdminUserById(req.user?.adminUserId);
    if (!user) return res.json(ok({ displayName: '管理员', role: 'admin', legacy: true }));
    res.json(ok(publicAdminUser(user)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/bind-phone/send-code', async (req: any, res: any) => {
  try {
    if (!isPhoneCodeLoginAvailable()) {
      return res.status(503).json(err(new Error('短信验证暂未启用')));
    }
    const result = await createAndSendPhoneCode(req, 'admin_bind_phone', req.body?.phone);
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/bind-phone', async (req: any, res: any) => {
  try {
    const verifiedPhone = await verifyPhoneCode('admin_bind_phone', req.body?.phone, req.body?.code);
    const existingPhone = await getAdminUserByPhone(verifiedPhone);
    if (existingPhone && existingPhone.id !== req.user?.adminUserId) {
      return res.status(409).json(err(new Error('这个手机号已经绑定其他后台账号')));
    }

    let user = await getAdminUserById(req.user?.adminUserId);
    if (!user) {
      const store = await createStoreForAdminAccount('店家管理员', null, verifiedPhone);
      const { data, error } = await supabase.from('jzg_admin_users').insert({
        tenant_id: store.id,
        store_id: store.id,
        phone: verifiedPhone,
        display_name: '店家管理员',
        role: 'store_admin',
        status: 'active',
        phone_verified_at: new Date().toISOString(),
        auth_provider: 'legacy_bind_phone',
      }).select('*').single();
      if (error) throw error;
      user = data;
    } else {
      const { data, error } = await supabase.from('jzg_admin_users').update({
        phone: verifiedPhone,
        phone_verified_at: new Date().toISOString(),
        auth_provider: user.auth_provider || 'phone_bound',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).select('*').single();
      if (error) throw error;
      user = data;
    }
    res.json(ok({ token: makeAdminToken(user), user: publicAdminUser(user) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/password/change', async (req: any, res: any) => {
  try {
    const newPassword = cleanText(req.body?.newPassword || req.body?.password, 120);
    const currentPassword = cleanText(req.body?.currentPassword, 120);
    if (newPassword.length < 8) return res.status(400).json(err(new Error('新密码至少 8 位')));

    const user = await getAdminUserById(req.user?.adminUserId);
    if (!user || user.status !== 'active') return res.status(401).json(err(new Error('请先登录后台账号')));
    if (user.password_hash) {
      if (!currentPassword) return res.status(400).json(err(new Error('请填写当前密码')));
      const matched = await bcrypt.compare(currentPassword, user.password_hash);
      if (!matched) return res.status(401).json(err(new Error('当前密码错误')));
      if (await bcrypt.compare(newPassword, user.password_hash)) {
        return res.status(400).json(err(new Error('新密码不能和原密码相同')));
      }
    }

    const { data: updated, error: updateErr } = await supabase.from('jzg_admin_users').update({
      password_hash: await bcrypt.hash(newPassword, 10),
      auth_provider: user.auth_provider || 'password_changed',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id).select('*').single();
    if (updateErr) throw updateErr;
    res.json(ok({ token: makeAdminToken(updated), user: publicAdminUser(updated) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/auth/password/change-email', async (req: any, res: any) => {
  try {
    const newPassword = cleanText(req.body?.newPassword || req.body?.password, 120);
    if (newPassword.length < 8) return res.status(400).json(err(new Error('新密码至少 8 位')));

    const user = await getAdminUserById(req.user?.adminUserId);
    if (!user || user.status !== 'active') return res.status(401).json(err(new Error('请先登录后台账号')));
    const email = normalizeEmail(user.email);
    await verifyEmailCode('admin_reset_password', email, req.body?.code);
    if (user.password_hash && await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json(err(new Error('新密码不能和原密码相同')));
    }

    const { data: updated, error: updateErr } = await supabase.from('jzg_admin_users').update({
      password_hash: await bcrypt.hash(newPassword, 10),
      email_verified_at: user.email_verified_at || new Date().toISOString(),
      auth_provider: 'email_verified_password_change',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id).select('*').single();
    if (updateErr) throw updateErr;
    res.json(ok({ token: makeAdminToken(updated), user: publicAdminUser(updated) }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/auth/verify', (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json(ok({ valid: false }));
  try { const payload = jwt.verify(auth.substring(7), JWT_SECRET); res.json(ok({ valid: true, payload })); }
  catch { res.json(ok({ valid: false })); }
});

// ===== Platform / 超级管理员 =====
app.get('/api/platform/summary', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const [
      storesCount,
      activeStoresCount,
      adminUsersCount,
      scriptsCount,
      schedulesCount,
      recentStores,
      recentAdminUsers,
      recentSchedules,
    ] = await Promise.all([
      supabase.from('jzg_stores').select('*', { count: 'exact', head: true }),
      supabase.from('jzg_stores').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('jzg_admin_users').select('*', { count: 'exact', head: true }),
      supabase.from('scripts').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true }),
      supabase.from('jzg_stores').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('jzg_admin_users').select('id,email,phone,display_name,role,status,tenant_id,store_id,last_login_at,created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('schedules').select('id,tenant_id,script_id,scheduled_date,start_time,status,created_at').order('created_at', { ascending: false }).limit(8),
    ]);
    for (const result of [storesCount, activeStoresCount, adminUsersCount, scriptsCount, schedulesCount, recentStores, recentAdminUsers, recentSchedules]) {
      if (result.error) throw result.error;
    }
    const adminStoreMap = await getStoreMapByIds((recentAdminUsers.data || []).map((user: any) => user.store_id || user.tenant_id));
    const scheduleStoreMap = await getStoreMapByIds((recentSchedules.data || []).map((schedule: any) => schedule.tenant_id));
    const scriptIds = Array.from(new Set((recentSchedules.data || []).map((schedule: any) => cleanText(schedule.script_id, 80)).filter(Boolean)));
    const scriptsById = new Map<string, any>();
    if (scriptIds.length) {
      const { data: scripts, error: scriptsErr } = await supabase.from('scripts').select('id,name').in('id', scriptIds);
      if (scriptsErr) throw scriptsErr;
      (scripts || []).forEach((script: any) => scriptsById.set(script.id, script));
    }
    res.json(ok({
      storeCount: storesCount.count || 0,
      activeStoreCount: activeStoresCount.count || 0,
      adminUserCount: adminUsersCount.count || 0,
      scriptCount: scriptsCount.count || 0,
      scheduleCount: schedulesCount.count || 0,
      recentStores: recentStores.data || [],
      recentAdminUsers: (recentAdminUsers.data || []).map((user: any) => ({
        ...user,
        store: adminStoreMap.get(user.store_id || user.tenant_id) || null,
      })),
      recentSchedules: (recentSchedules.data || []).map((schedule: any) => ({
        ...schedule,
        store: scheduleStoreMap.get(schedule.tenant_id) || null,
        script: scriptsById.get(schedule.script_id) || null,
      })),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/platform/stores', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data: stores, error } = await supabase.from('jzg_stores').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = await Promise.all((stores || []).map(async (store: any) => {
      const [admins, scripts, schedules, actors, customers] = await Promise.all([
        supabase.from('jzg_admin_users').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
        supabase.from('scripts').select('*', { count: 'exact', head: true }).eq('tenant_id', store.id),
        supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('tenant_id', store.id),
        supabase.from('actors').select('*', { count: 'exact', head: true }).eq('tenant_id', store.id),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', store.id),
      ]);
      return {
        ...store,
        admin_count: admins.count || 0,
        script_count: scripts.count || 0,
        schedule_count: schedules.count || 0,
        actor_count: actors.count || 0,
        customer_count: customers.count || 0,
      };
    }));
    res.json(ok(rows));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/platform/admin-users', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data, error } = await supabase.from('jzg_admin_users')
      .select('id,email,phone,display_name,role,status,tenant_id,store_id,email_verified_at,phone_verified_at,last_login_at,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const storeMap = await getStoreMapByIds((data || []).map((user: any) => user.store_id || user.tenant_id));
    res.json(ok((data || []).map((user: any) => ({
      ...user,
      store: storeMap.get(user.store_id || user.tenant_id) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/platform/admin-users/:id/status', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const status = cleanText(req.body?.status, 20);
    if (!['active', 'disabled'].includes(status)) return res.status(400).json(err(new Error('账号状态无效')));
    const { data, error } = await supabase.from('jzg_admin_users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id,email,role,status')
      .single();
    if (error) throw error;
    await logPlatformAction(req, `admin_user_${status}`, { type: 'admin_user', id: data.id, label: data.email }, { status });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/platform/admin-users/:id/reset-password', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const tempPassword = `JSC-${crypto.randomBytes(9).toString('base64url')}-9!`;
    const { data, error } = await supabase.from('jzg_admin_users')
      .update({
        password_hash: await bcrypt.hash(tempPassword, 10),
        auth_provider: 'super_admin_password_reset',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id,email,role,status')
      .single();
    if (error) throw error;
    await logPlatformAction(req, 'admin_user_reset_password', { type: 'admin_user', id: data.id, label: data.email });
    res.json(ok({ user: data, tempPassword }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/platform/impersonate-store', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const storeId = cleanText(req.body?.storeId, 80);
    const { data: store, error } = await supabase.from('jzg_stores').select('*').eq('id', storeId).single();
    if (error) throw error;
    if (!store) return res.status(404).json(err(new Error('店家不存在')));
    const sessionUser = {
      id: req.user?.adminUserId,
      tenant_id: store.id,
      store_id: store.id,
      email: req.user?.email,
      display_name: `超管查看：${store.name}`,
      role: 'store_admin',
      status: 'active',
    };
    await logPlatformAction(req, 'impersonate_store', { type: 'store', id: store.id, label: store.name });
    res.json(ok({ token: makeAdminToken(sessionUser), user: publicAdminUser(sessionUser), store }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/platform/script-templates', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data, error } = await supabase.from('jzg_script_templates')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    if (error && String(error.message || '').includes('jzg_script_templates')) return res.json(ok([]));
    if (error) throw error;
    const storeMap = await getStoreMapByIds((data || []).map((template: any) => template.source_tenant_id));
    res.json(ok((data || []).map((template: any) => ({
      ...template,
      store: storeMap.get(template.source_tenant_id) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/platform/audit-logs', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data, error } = await supabase.from('jzg_platform_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error && String(error.message || '').includes('jzg_platform_audit_logs')) return res.json(ok([]));
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Stores / 多店家后台 =====
app.get('/api/stores', async (req: any, res: any) => {
  try {
    let query = supabase.from('jzg_stores').select('*').order('created_at', { ascending: false });
    if (!isSuperAdminReq(req)) query = query.eq('id', currentTenantId(req));
    const { data, error } = await query;
    if (error && String(error.message || '').includes('jzg_stores')) {
      return res.json(ok([{ id: TENANT_ID, name: '默认店家', city: '未设置', status: 'active' }]));
    }
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/stores', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
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
    await logPlatformAction(req, 'store_create', { type: 'store', id: data.id, label: data.name }, { city: data.city, address: data.address });
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
    const tenantId = currentTenantId(req);
    const { data: s, error: scriptErr } = await supabase.from('scripts')
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();
    if (scriptErr) throw scriptErr;
    if (!s) return res.status(404).json(err(new Error('剧本不存在')));

    const payload = {
      source_script_id: s.id,
      source_tenant_id: tenantId,
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
    const tenantId = currentTenantId(req);
    const { data: t, error: templateErr } = await supabase.from('jzg_script_templates').select('*').eq('id', req.params.id).single();
    if (templateErr) throw templateErr;
    if (!t) return res.status(404).json(err(new Error('模版不存在')));

    const { data: existing } = await supabase.from('scripts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', t.name)
      .maybeSingle();
    if (existing) return res.json(ok({ id: existing.id, existing: true }));

    const { data: script, error: scriptErr } = await supabase.from('scripts').insert({
      name: t.name,
      duration_minutes: t.duration_minutes || 240,
      min_duration_hours: t.min_duration_hours || 4,
      max_duration_hours: t.max_duration_hours || 4,
      tenant_id: tenantId,
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
app.get('/api/rooms', async (req: any, res: any) => {
  try { const { data } = await supabase.from('rooms').select('*').eq('tenant_id', currentTenantId(req)).order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/rooms', async (req: any, res: any) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写房间名称')));
    const { data } = await supabase.from('rooms').insert({ name, capacity: capacity || 0, tenant_id: currentTenantId(req), status: 'active' }).select().single();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').update(req.body).eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/rooms/:id', async (req: any, res: any) => {
  try { await supabase.from('rooms').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Actors (卡司/DM) =====
app.get('/api/actors', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('actors').select('*').eq('tenant_id', currentTenantId(req)).order('name');
    const enriched = await Promise.all((data || []).map(async (a: any) => {
      const lc = await ensureLingqiDmProfileForActor(a);
      return { ...a, lc_profile: lc };
    }));
    res.json(ok(enriched));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors', async (req: any, res: any) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写卡司姓名')));
    const { data } = await supabase.from('actors').insert({ name, phone: phone || null, tenant_id: currentTenantId(req) }).select().single();
    const lcProfile = await ensureLingqiDmProfileForActor(data || { name, phone });
    res.json(ok({ id: data?.id, lc_profile: lcProfile }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/actors/:id', async (req: any, res: any) => {
  try {
    await supabase.from('actors').update({ name: req.body.name, phone: req.body.phone || null }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    const lcProfile = await ensureLingqiDmProfileForActor({ name: req.body.name, phone: req.body.phone });
    res.json(ok({ lc_profile: lcProfile }));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/actors/:id', async (req: any, res: any) => {
  try { await supabase.from('actors').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/actors/:id/skills', async (req: any, res: any) => {
  try {
    const { data: actor } = await supabase.from('actors').select('id').eq('id', req.params.id).eq('tenant_id', currentTenantId(req)).maybeSingle();
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
      supabase.from('actors').select('id').eq('id', req.params.id).eq('tenant_id', currentTenantId(req)).maybeSingle(),
      supabase.from('scripts').select('id').eq('id', scriptId).eq('tenant_id', currentTenantId(req)).maybeSingle(),
    ]);
    if (!actor || !script) return res.status(404).json(err(new Error('卡司或剧本不存在')));
    const { data } = await supabase.from('actor_skills').insert({ actor_id: req.params.id, script_id: scriptId, role_name: roleName, role_type: roleType || 'actor', proficiency: proficiency || 1 }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Scripts =====
app.get('/api/scripts', async (req: any, res: any) => {
  try {
    const { data: scripts } = await supabase.from('scripts').select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)').eq('tenant_id', currentTenantId(req)).order('name');
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
    const { data: s } = await supabase.from('scripts').select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender)').eq('id', req.params.id).eq('tenant_id', currentTenantId(req)).single();
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
      name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60, max_duration_hours: (maxDuration || 0) / 60, tenant_id: currentTenantId(req)
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
    const tenantId = currentTenantId(req);
    const { data: owned } = await supabase.from('scripts').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!owned) return res.status(404).json(err(new Error('剧本不存在')));
    await supabase.from('scripts').update({ name, duration_minutes: minDuration, min_duration_hours: (minDuration || 0) / 60, max_duration_hours: (maxDuration || 0) / 60 }).eq('id', req.params.id).eq('tenant_id', tenantId);
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
  try { await supabase.from('scripts').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Schedules =====
app.get('/api/schedules', async (req: any, res: any) => {
  try {
    let q = supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('tenant_id', currentTenantId(req)).order('scheduled_date');
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
    const { data: s } = await supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('id', req.params.id).eq('tenant_id', currentTenantId(req)).single();
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
    const tenantId = currentTenantId(req);
    // 优先使用前端直接传的时间字符串（避免时区转换问题）
    const dateStr = d.date || (d.startTime ? d.startTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    const startTimeStr = d.timeStart || (d.startTime ? d.startTime.split('T')[1]?.substring(0, 5) : '14:00');
    const endTimeStr = d.timeEnd || (d.endTime ? d.endTime.split('T')[1]?.substring(0, 5) : '17:00');
    const { data } = await supabase.from('schedules').insert({
      script_id: d.scriptId, room_id: d.roomId || null,
      scheduled_date: dateStr, start_time: startTimeStr, end_time: endTimeStr,
      status: d.status || 'pending', player_count: d.playerCount || 0,
      customer_name: d.customerName || null,
      customer_phone: d.customerPhone || null,
      note: d.note || null,
      tenant_id: tenantId
    }).select().single();
    if (d.actors && d.actors.length) await supabase.from('schedule_actors').insert(d.actors.map((a: any) => ({ schedule_id: data!.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(data!.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    res.json(ok({ ...data, lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const d = req.body;
    const tenantId = currentTenantId(req);
    const { data: owned } = await supabase.from('schedules').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!owned) return res.status(404).json(err(new Error('排期不存在')));
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
    await supabase.from('schedules').update(fields).eq('id', req.params.id).eq('tenant_id', tenantId);
    if (d.actors) {
      await supabase.from('schedule_actors').delete().eq('schedule_id', req.params.id);
      if (d.actors.length) await supabase.from('schedule_actors').insert(d.actors.map((a: any) => ({ schedule_id: req.params.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
    }
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    res.json(ok({ lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/schedules/:id', async (req: any, res: any) => {
  try { await supabase.from('schedules').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/confirm', async (req: any, res: any) => {
  try {
    if (!req.body.roomId) return res.status(400).json(err(new Error('请选择房间')));
    const tenantId = currentTenantId(req);
    await supabase.from('schedules').update({ room_id: req.body.roomId, status: 'scheduled' }).eq('id', req.params.id).eq('tenant_id', tenantId);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    res.json(ok({ lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/cancel', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    await supabase.from('schedules').update({ status: req.body.status || 'cancelled' }).eq('id', req.params.id).eq('tenant_id', tenantId);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    res.json(ok({ lingqi_sync: lingqiSync }));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/complete', async (req: any, res: any) => {
  try { await supabase.from('schedules').update({ status: 'completed' }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/dm-start', async (req: any, res: any) => {
  try {
    const { actorId } = req.body;
    await supabase.from('schedules').update({ status: 'ongoing', scheduled_date: new Date().toISOString().split('T')[0], start_time: new Date().toISOString().split('T')[1]?.substring(0, 5) }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    if (actorId) {
      await supabase.from('schedule_actors').insert({ schedule_id: req.params.id, actor_id: actorId, role_name: 'DM', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 240 * 60000).toISOString() });
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== 冲突检测 =====
app.get('/api/schedules/conflicts/check', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
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
        .eq('schedules.tenant_id', tenantId)
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
        .eq('tenant_id', tenantId)
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
      await supabase.from('lc_profiles').update({
        phone_verified_at: new Date().toISOString(),
        auth_provider: existing.auth_provider || 'phone',
        identity_roles: normalizeIdentityRoles(existing, ['player']),
        role_type: preferredRoleType(existing, ['player']),
      }).eq('id', existing.id);
      return res.json(ok({ id: existing.id, display_name: existing.display_name, phone: existing.phone, newUser: false }));
    }
    const { data: newPlayer } = await supabase.from('lc_profiles').insert({
      phone: verifiedPhone,
      display_name: `玩家${verifiedPhone.slice(-4)}`,
      role: 'player',
      role_type: 'player',
      identity_roles: ['player'],
      is_visible: true,
      balance: 0,
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
app.get('/api/customers', async (req: any, res: any) => {
  try { const { data } = await supabase.from('customers').select('*').eq('tenant_id', currentTenantId(req)).order('name'); res.json(ok(data)); }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/customers/search', async (req: any, res: any) => {
  try {
    const q = req.query.q || '';
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', currentTenantId(req)).or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order('name').limit(20);
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/customers', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('customers').insert({ name: req.body.name, phone: req.body.phone || null, membership_level: req.body.membershipLevel || 'none', balance: req.body.balance || 0, tenant_id: currentTenantId(req) }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').update(req.body).eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
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

// ===== DM internal workbench =====
app.post('/api/dm/send-code', async (req: any, res: any) => {
  try {
    if (!isPhoneCodeLoginAvailable()) {
      return res.status(503).json(err(new Error('短信验证暂未启用，当前可使用已登记手机号登录')));
    }
    const result = await createAndSendPhoneCode(req, 'dm_login', req.body?.phone);
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/dm/auth/config', async (_req: any, res: any) => {
  res.json(ok({
    smsEnabled: isPhoneCodeLoginAvailable(),
    smsRequired: isTencentSmsConfigured(),
    wechatEnabled: false,
    legacyPhoneLoginEnabled: !isTencentSmsConfigured(),
  }));
});

app.post('/api/dm/login', async (req: any, res: any) => {
  try {
    const { phone, code } = req.body;
    const hasCode = typeof code === 'string' && code.trim().length > 0;
    if (isTencentSmsConfigured() && !hasCode) return res.status(400).json(err(new Error('请先获取并填写短信验证码')));
    const verifiedPhone = hasCode ? await verifyPhoneCode('dm_login', phone, code) : normalizeChinaPhone(phone);
    const actor = await findActorByPhone(verifiedPhone);
    if (!actor) {
      return res.status(404).json(err(new Error('这个手机号还没有登记为店内 DM，请先让店家在卡司管理里登记手机号')));
    }
    await ensureLingqiDmProfileForActor(actor);
    const token = jwt.sign({ role: 'dm', actorId: actor.id, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({
      token,
      actor: {
        id: actor.id,
        name: actor.name,
        phone: verifiedPhone,
      },
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/dm/dashboard', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.user?.actorId || req.query.actorId, 80);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));

    const { data: actor, error: actorErr } = await supabase.from('actors')
      .select('*')
      .eq('id', actorId)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();
    if (actorErr) throw actorErr;
    if (!actor) return res.status(404).json(err(new Error('DM 不存在')));

    const { data: assignmentRows, error: assignmentErr } = await supabase.from('schedule_actors')
      .select('id, role_name, start_time, end_time, schedules!inner(id, tenant_id, scheduled_date, start_time, end_time, status, player_count, customer_name, note, script_id, room_id, scripts(id, name), rooms(id, name))')
      .eq('actor_id', actorId)
      .eq('schedules.tenant_id', TENANT_ID);
    if (assignmentErr) throw assignmentErr;

    const schedules = (assignmentRows || []).map((row: any) => {
      const schedule = scheduleRelation(row);
      const startAt = combineScheduleDateTime(schedule, 'start_time');
      const endAt = combineScheduleDateTime(schedule, 'end_time');
      return {
        assignmentId: row.id,
        scheduleId: schedule?.id,
        scriptId: schedule?.script_id || null,
        scriptName: relationName(schedule, 'scripts') || '未命名剧本',
        roomName: relationName(schedule, 'rooms') || null,
        roleName: cleanText(row.role_name, 80) || 'DM',
        startAt,
        endAt,
        status: cleanText(schedule?.status, 30) || 'pending',
        statusText: statusText(schedule?.status),
        customerName: cleanText(schedule?.customer_name, 80) || null,
        playerCount: Number(schedule?.player_count || 0),
        note: cleanText(schedule?.note, 500) || null,
      };
    }).filter((item: any) => item.scheduleId);

    schedules.sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const now = Date.now();
    const currentMonth = monthKey();
    const activeSchedules = schedules.filter((item: any) => !isClosedSchedule(item.status));
    const completedSchedules = activeSchedules.filter((item: any) => (
      item.status === 'completed' || new Date(item.startAt).getTime() < now
    ));
    const currentMonthSchedules = activeSchedules.filter((item: any) => item.startAt.startsWith(currentMonth));
    const currentMonthCompleted = currentMonthSchedules.filter((item: any) => (
      item.status === 'completed' || new Date(item.startAt).getTime() < now
    ));
    const currentMonthUpcoming = currentMonthSchedules.filter((item: any) => new Date(item.startAt).getTime() >= now);

    const scriptStatsMap = new Map<string, any>();
    for (const item of completedSchedules) {
      const key = item.scriptId || item.scriptName;
      const stat = scriptStatsMap.get(key) || {
        scriptId: item.scriptId,
        scriptName: item.scriptName,
        count: 0,
        lastOpenedAt: item.startAt,
        roles: [],
      };
      stat.count += 1;
      stat.lastOpenedAt = new Date(item.startAt).getTime() > new Date(stat.lastOpenedAt).getTime() ? item.startAt : stat.lastOpenedAt;
      stat.roles = uniqueTexts([...(stat.roles || []), item.roleName], 12);
      scriptStatsMap.set(key, stat);
    }
    const scriptStats = Array.from(scriptStatsMap.values()).sort((a: any, b: any) => b.count - a.count);

    const scheduleIds = schedules.map((item: any) => item.scheduleId).filter(Boolean);
    let evaluations: any[] = [];
    if (scheduleIds.length) {
      const { data: evaluationRows, error: evaluationErr } = await supabase.from('evaluations')
        .select('schedule_id, rating, comment, created_at')
        .in('schedule_id', scheduleIds);
      if (evaluationErr) throw evaluationErr;
      evaluations = evaluationRows || [];
    }

    const { data: skillRows, error: skillErr } = await supabase.from('actor_skills')
      .select('id, script_id, role_name, role_type, proficiency, scripts(name)')
      .eq('actor_id', actorId);
    if (skillErr) throw skillErr;
    const skills = (skillRows || []).map((skill: any) => ({
      id: skill.id,
      scriptId: skill.script_id,
      scriptName: relationName(skill, 'scripts') || '未命名剧本',
      roleName: cleanText(skill.role_name, 80),
      roleType: cleanText(skill.role_type, 30) || 'actor',
      proficiency: Number(skill.proficiency || 1),
    }));

    let leaveRequests: any[] = [];
    const leaveQuery = await supabase.from('jzg_dm_leave_requests')
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (leaveQuery.error && !isMissingRelationError(leaveQuery.error, 'jzg_dm_leave_requests')) throw leaveQuery.error;
    leaveRequests = leaveQuery.data || [];

    let experienceNotes: any[] = [];
    const noteQuery = await supabase.from('jzg_dm_experience_notes')
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (noteQuery.error && !isMissingRelationError(noteQuery.error, 'jzg_dm_experience_notes')) throw noteQuery.error;
    experienceNotes = noteQuery.data || [];

    const ratings = evaluations.map((item: any) => Number(item.rating || 0)).filter((rating: number) => rating > 0);
    const avgRating = ratings.length ? Math.round((ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
    const feedbackScore = avgRating ? Math.min(100, avgRating * 20) : 68;
    const stabilityScore = Math.min(100, completedSchedules.length * 5 + currentMonthUpcoming.length * 2);
    const experienceScore = Math.min(100, scriptStats.length * 12 + completedSchedules.length * 3 + skills.length * 4);
    const ratingScore = Math.round(feedbackScore * 0.35 + stabilityScore * 0.3 + experienceScore * 0.35);

    const upcomingTasks = activeSchedules
      .filter((item: any) => new Date(item.startAt).getTime() >= now)
      .slice(0, 5)
      .map((item: any) => ({
        id: `schedule-${item.scheduleId}`,
        title: `${item.scriptName} · ${item.roleName}`,
        dueAt: item.startAt,
        dueLabel: new Date(item.startAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        priority: item.status === 'ongoing' ? 'high' : 'normal',
        status: item.statusText,
        source: '排班',
      }));
    const skillTasks = skills
      .filter((skill: any) => skill.proficiency < 3)
      .slice(0, 3)
      .map((skill: any) => ({
        id: `skill-${skill.id}`,
        title: `补齐 ${skill.scriptName} 的 ${skill.roleName || '角色'} 熟练度`,
        dueAt: null,
        dueLabel: '持续维护',
        priority: 'low',
        status: `熟练度 ${skill.proficiency}/5`,
        source: '技能',
      }));
    const tasks = [...upcomingTasks, ...skillTasks].slice(0, 8);

    res.json(ok({
      actor: {
        id: actor.id,
        name: actor.name,
        phone: normalizeProfilePhone(actor.phone),
        totalSessions: completedSchedules.length,
        totalScripts: scriptStats.length,
        level: dmRatingLevel(ratingScore),
      },
      schedules,
      tasks,
      salaryEstimate: {
        month: currentMonth,
        completedSessions: currentMonthCompleted.length,
        upcomingSessions: currentMonthUpcoming.length,
        estimatedMin: currentMonthCompleted.length * 150 + currentMonthUpcoming.length * 120,
        estimatedMax: currentMonthCompleted.length * 240 + currentMonthUpcoming.length * 220,
        rules: [
          '已完成场次按 150-240 元/场估算',
          '未来已排场次按 120-220 元/场估算',
          '最终工资以店家结算规则、临时补贴和扣款为准',
        ],
      },
      rating: {
        level: dmRatingLevel(ratingScore),
        score: ratingScore,
        stabilityScore,
        feedbackScore: Math.round(feedbackScore),
        experienceScore,
        avgRating,
        feedbackCount: ratings.length,
      },
      scriptStats,
      skills,
      leaveRequests,
      experienceNotes,
      meta: {
        leaveTableReady: !leaveQuery.error,
        experienceTableReady: !noteQuery.error,
      },
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/dm/leave-requests', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.user?.actorId, 80);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));
    const startDate = cleanText(req.body?.startDate, 20);
    const endDate = cleanText(req.body?.endDate, 20) || startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json(err(new Error('请填写正确的请假日期')));
    }
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      return res.status(400).json(err(new Error('结束日期不能早于开始日期')));
    }
    const payload = {
      tenant_id: TENANT_ID,
      actor_id: actorId,
      start_date: startDate,
      end_date: endDate,
      leave_type: cleanText(req.body?.leaveType, 30) || '事假',
      reason: cleanText(req.body?.reason, 500) || null,
      status: 'pending',
    };
    const { data, error } = await supabase.from('jzg_dm_leave_requests').insert(payload).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/dm/experience-notes', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.user?.actorId, 80);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));
    const scheduleId = cleanText(req.body?.scheduleId, 80);
    let scriptId = cleanText(req.body?.scriptId, 80) || null;
    let scriptName = cleanText(req.body?.scriptName, 120);

    if (scheduleId) {
      const { data: assignment, error: assignmentErr } = await supabase.from('schedule_actors')
        .select('schedules!inner(id, tenant_id, script_id, scripts(id, name))')
        .eq('actor_id', actorId)
        .eq('schedule_id', scheduleId)
        .eq('schedules.tenant_id', TENANT_ID)
        .maybeSingle();
      if (assignmentErr) throw assignmentErr;
      const schedule = scheduleRelation(assignment);
      if (!schedule) return res.status(404).json(err(new Error('未找到可关联的开本记录')));
      scriptId = schedule.script_id || scriptId;
      scriptName = relationName(schedule, 'scripts') || scriptName;
    }

    const title = cleanText(req.body?.title, 120);
    const content = cleanText(req.body?.content, 3000);
    if (!scriptName) return res.status(400).json(err(new Error('请选择或填写剧本名称')));
    if (!title) return res.status(400).json(err(new Error('请填写经验标题')));
    if (!content) return res.status(400).json(err(new Error('请填写经验内容')));

    const rawTags = Array.isArray(req.body?.tags)
      ? req.body.tags
      : cleanText(req.body?.tags, 200).split(/[，,\s]+/);
    const tags = uniqueTexts(rawTags, 8);
    const visibility = cleanText(req.body?.visibility, 20) === 'private' ? 'private' : 'internal';
    const { data, error } = await supabase.from('jzg_dm_experience_notes').insert({
      tenant_id: TENANT_ID,
      actor_id: actorId,
      schedule_id: scheduleId || null,
      script_id: scriptId,
      script_name: scriptName,
      title,
      content,
      tags,
      visibility,
    }).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
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
