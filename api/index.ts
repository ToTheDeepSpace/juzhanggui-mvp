// Vercel Serverless 入口 — 自包含，由 @vercel/node 编译
// 所有路由内联在此文件

import express from 'express';
import cors from 'cors';
import { createTencentPgClient, tencentPgPool } from './tencentPgSupabase.js';
import { db } from './db/drizzle.js';
import { jzgStores, rooms } from './db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeUploadedImageDataUrl } from './uploadSecurity.js';
import {
  buildCosObjectKey,
  createTencentCosUploadTransport,
  getCosUploadConfig,
  normalizeUploadRelativePath,
  saveSanitizedUploadImage,
} from './uploadStorage.js';
import {
  mergeSharedCredits,
  mergeSharedRoles,
  normalizeSharedCredits,
  normalizeSharedRoles,
  normalizeSharedScriptKey,
  publicSharedScriptTemplate,
} from './sharedScriptLibrary.js';

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(`juzhanggui:${phone.trim()}`).digest('hex');
}

const useTencentPg = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const supabase = useTencentPg
  ? createTencentPgClient()
  : createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    );

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
const SUPER_ADMIN_EMAIL = 'hnnkkk@qq.com';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('Missing JWT_SECRET');
  console.warn('⚠ JWT_SECRET env is not set — using local development fallback.');
  return 'local-dev-jwt-secret-change-me';
})();
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
const configuredJumuluSiteUrl = process.env.JUMULU_SITE_URL || process.env.VITE_JUMULU_SITE_URL || process.env.LINGQI_SITE_URL || process.env.VITE_LINGQI_SITE_URL || 'https://jumulu.jusichen.com';
const JUMULU_SITE_URL = configuredJumuluSiteUrl
  .replace(/^https:\/\/lingqi\.jusichen\.com(?=\/|$)/, 'https://jumulu.jusichen.com')
  .replace(/\/$/, '');
const JZG_WECHAT_OPEN_APP_ID = process.env.JZG_WECHAT_OPEN_APP_ID || process.env.WECHAT_OPEN_APP_ID || '';
const JZG_WECHAT_OPEN_APP_SECRET = process.env.JZG_WECHAT_OPEN_APP_SECRET || process.env.WECHAT_OPEN_APP_SECRET || '';
const JZG_WECHAT_REDIRECT_URI = process.env.JZG_WECHAT_REDIRECT_URI || `${JUZHANGGUI_SITE_URL}/api/player/wechat/callback`;
const LOCAL_UPLOAD_ROOT = process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads');
const COS_UPLOAD_CONFIG = getCosUploadConfig(process.env);
const COS_UPLOAD_TRANSPORT = COS_UPLOAD_CONFIG ? createTencentCosUploadTransport(COS_UPLOAD_CONFIG) : null;
const SHARED_SCRIPT_LIBRARY_TOKEN = process.env.SHARED_SCRIPT_LIBRARY_TOKEN || '';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = new Set([
      JUZHANGGUI_SITE_URL,
      JUMULU_SITE_URL,
      'https://lingqi.jusichen.com',
      ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean),
    ]);
    if (!origin || allowedOrigins.has(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin denied'));
  },
  credentials: true,
}));
const uploadStaticOptions = {
  setHeaders(res: any) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
};
app.use('/uploads', express.static(LOCAL_UPLOAD_ROOT, uploadStaticOptions));
app.get('/api/uploads/*', async (req: any, res: any, next: any) => {
  if (!COS_UPLOAD_CONFIG || !COS_UPLOAD_TRANSPORT?.getObject) return next();
  try {
    const relativePath = normalizeUploadRelativePath(req.params[0]);
    if (!relativePath) return res.status(400).json({ error: '图片路径不合法' });
    const object = await COS_UPLOAD_TRANSPORT.getObject(buildCosObjectKey(COS_UPLOAD_CONFIG, relativePath));
    if (object.status === 404) return next();
    if (!object.ok) throw new Error(`COS 图片读取失败：${object.status}`);
    res.setHeader('Content-Type', object.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', object.cacheControl || 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(object.body);
  } catch (e) {
    next(e);
  }
});
app.use('/api/uploads', express.static(LOCAL_UPLOAD_ROOT, uploadStaticOptions));
app.use(express.json({ limit: '12mb' }));

function createRateLimiter(name: string, windowMs: number, max: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  let cleanupCounter = 0;
  return (req: any, res: any, next: any) => {
    const now = Date.now();
    cleanupCounter += 1;
    if (cleanupCounter >= 500 || entries.size > 10_000) {
      cleanupCounter = 0;
      for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
    }
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const existing = entries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;
    entry.count += 1;
    entries.set(key, entry);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, error: '操作太频繁，请稍后再试' });
    }
    next();
  };
}

const authRateLimit = createRateLimiter('auth', 15 * 60 * 1000, 40);
const verificationRateLimit = createRateLimiter('verification', 10 * 60 * 1000, 6);
const playerActionRateLimit = createRateLimiter('player-action', 15 * 60 * 1000, 20);
const uploadRateLimit = createRateLimiter('upload', 10 * 60 * 1000, 30);

app.use((req: any, res: any, next: any) => {
  const pathname = req.path;
  if (req.method === 'POST' && /\/(?:send-code)$/.test(pathname)) return verificationRateLimit(req, res, next);
  if (req.method === 'POST' && (
    pathname.startsWith('/api/auth/')
    || pathname === '/api/player/login'
    || pathname === '/api/dm/login'
    || pathname === '/api/player/verify-code'
  )) return authRateLimit(req, res, next);
  if (req.method === 'POST' && isPlayerScheduleAction(pathname)) return playerActionRateLimit(req, res, next);
  if (req.method === 'POST' && pathname.startsWith('/api/uploads/')) return uploadRateLimit(req, res, next);
  next();
});

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
  '/api/player/auth/config',
  '/api/player/join-schedules',
  '/api/player/verify-code',
  '/api/player/wechat/url',
  '/api/player/wechat/start',
  '/api/player/wechat/callback',
  '/api/dm/auth/config',
  '/api/dm/login',
  '/api/dm/send-code',
  '/api/shared/script-library',
  '/api/shared/script-library/contributions',
  '/api/shared/script-library/carpool-sync',
];
const PUBLIC_SUFFIXES = ['/public'];

function isPlayerScheduleAction(pathname: string): boolean {
  return /^\/api\/schedules\/[^/]+\/(?:checkin|evaluate)$/.test(pathname);
}

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  for (const s of PUBLIC_SUFFIXES) if (path.endsWith(s)) return true;
  return false;
}

app.use(async (req: any, res: any, next: any) => {
  if (req.originalUrl && req.originalUrl !== req.url) req.url = req.originalUrl;
  if (isPublicPath(req.path) || req.method === 'OPTIONS') return next();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: '未登录' });
  try {
    const decoded = jwt.verify(auth.substring(7), JWT_SECRET) as any;
    req.user = decoded;
    if (isPlayerScheduleAction(req.path)) {
      if (decoded.role !== 'player') return res.status(403).json({ success: false, error: '请使用玩家账号操作' });
      return next();
    }
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

    if (decoded.role === 'admin') {
      const adminUser = await getAdminUserById(decoded.adminUserId);
      if (!adminUser || adminUser.status !== 'active') {
        return res.status(401).json({ success: false, error: '后台账号已停用或不存在，请重新登录' });
      }
      if (Number(decoded.sessionVersion || 0) !== Number(adminUser.session_version || 1)) {
        return res.status(401).json({ success: false, error: '登录状态已失效，请重新登录' });
      }
      if (decoded.impersonating) {
        if (adminUser.role !== 'super_admin') {
          return res.status(403).json({ success: false, error: '已无权进入店家视角' });
        }
      } else {
        req.user = {
          ...decoded,
          adminRole: adminUser.role,
          tenantId: adminUser.tenant_id || TENANT_ID,
          storeId: adminUser.store_id || null,
          email: adminUser.email || undefined,
          phone: adminUser.phone || undefined,
          displayName: adminUser.display_name || undefined,
        };
      }
    }
    next();
  }
  catch (authError) {
    console.error('[auth] session validation failed', authError);
    res.status(401).json({ success: false, error: '登录已过期' });
  }
});

function ok(d?: any) { return { success: true, data: d }; }
function err(e: any) {
  if (process.env.NODE_ENV === 'production' && (e?.code || e?.details || e?.hint)) {
    console.error('[api-error]', e?.code || '', e?.message || e);
    return { success: false, error: '服务器错误，请稍后重试' };
  }
  return { success: false, error: e?.message || String(e) };
}
function throwDbError(error: any) {
  if (error) throw error;
}
function sha256(input: string): string { return crypto.createHash('sha256').update(input).digest('hex'); }
function cleanText(input: unknown, max = 120): string {
  return typeof input === 'string' ? input.trim().slice(0, max) : '';
}

type ModerationPrecheckDecision = 'pass' | 'review' | 'block';
type ModerationPrecheckMatch = {
  label: string;
  severity: ModerationPrecheckDecision;
  field: string;
  excerpt: string;
};

const LOCAL_MODERATION_RULES: Array<{
  label: string;
  severity: ModerationPrecheckDecision;
  pattern: RegExp;
}> = [
  { label: 'identity_number', severity: 'block', pattern: /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g },
  { label: 'privacy_or_doxxing', severity: 'block', pattern: /(开盒|人肉|身份证|家庭住址|户籍|泄露隐私|偷拍视频)/g },
  { label: 'illegal_or_crime', severity: 'block', pattern: /(诈骗|赌博|毒品|枪支|卖淫|嫖娼|性交易|洗钱|套现|伪造证件|网暴|威胁恐吓)/g },
  { label: 'minor_high_risk', severity: 'block', pattern: /(未成年|小学生|初中生|未满十八|未满18).{0,12}(约|睡|性|黄色|陪睡|裸)/g },
  { label: 'phone_or_contact', severity: 'review', pattern: /(?:\+?86[-\s]?)?1[3-9]\d{9}/g },
  { label: 'wechat_or_qq', severity: 'review', pattern: /(微信|VX|vx|V信|企鹅|QQ|qq)[:：\s-]*[A-Za-z0-9_-]{5,}/g },
  { label: 'abuse_or_attack', severity: 'review', pattern: /(傻逼|煞笔|贱人|死妈|滚蛋|垃圾人|去死|婊子|人渣|烂人|畜生)/g },
  { label: 'rumor_or_defamation_risk', severity: 'review', pattern: /(听说|据说|群里说|别人说|网传|瓜说|没有证据|纯主观|造谣|挂人)/g },
  { label: 'sexual_content', severity: 'review', pattern: /(约炮|陪睡|裸聊|口交|做爱|上床|黄色服务|擦边|包夜)/g },
];

function maskModerationExcerpt(value: string) {
  return value
    .replace(/\b([1-9]\d{5})(\d{8})(\d{3}[\dXx])\b/g, '$1********$3')
    .replace(/(1[3-9])\d{4}(\d{4})/g, '$1****$2')
    .slice(0, 80);
}

function moderationDecisionRank(decision: ModerationPrecheckDecision) {
  return decision === 'block' ? 3 : decision === 'review' ? 2 : 1;
}

function runLocalModerationPrecheck(input: {
  scene: string;
  targetType: string;
  texts: Record<string, unknown>;
  allowContact?: boolean;
}) {
  const matches: ModerationPrecheckMatch[] = [];
  for (const [field, value] of Object.entries(input.texts)) {
    const text = cleanText(value, 6000);
    if (!text) continue;
    for (const rule of LOCAL_MODERATION_RULES) {
      if (input.allowContact && (rule.label === 'phone_or_contact' || rule.label === 'wechat_or_qq')) continue;
      const found = Array.from(text.matchAll(rule.pattern)).slice(0, 3);
      for (const item of found) {
        matches.push({
          label: rule.label,
          severity: rule.severity,
          field,
          excerpt: maskModerationExcerpt(item[0] || ''),
        });
      }
    }
  }
  const decision = matches.reduce<ModerationPrecheckDecision>(
    (current, item) => moderationDecisionRank(item.severity) > moderationDecisionRank(current) ? item.severity : current,
    'pass',
  );
  const labels = Array.from(new Set(matches.map(item => item.label)));
  const textForHash = Object.entries(input.texts).map(([field, value]) => `${field}:${cleanText(value, 6000)}`).join('\n');
  return {
    version: 'local_rules_v1',
    provider: 'local',
    scene: input.scene,
    target_type: input.targetType,
    decision,
    risk_score: Math.min(100, matches.reduce((sum, item) => sum + (item.severity === 'block' ? 40 : 18), 0)),
    risk_labels: labels,
    matches: matches.slice(0, 20),
    summary: decision === 'pass'
      ? '本地预审未发现明显风险'
      : decision === 'block'
        ? '本地预审发现高风险内容，建议人工优先复核'
        : '本地预审发现需关注内容，建议人工审核时重点查看',
    checked_at: new Date().toISOString(),
    text_hash: sha256(textForHash),
    paid_provider: 'not_enabled',
  };
}
const FEEDBACK_CATEGORIES = ['suggestion', 'bug', 'question', 'complaint', 'report', 'illegal_content', 'security', 'privacy', 'other'];
function feedbackCategoryValue(input: unknown) {
  const value = cleanText(input, 40) || 'suggestion';
  return FEEDBACK_CATEGORIES.includes(value) ? value : null;
}
function feedbackPriorityFor(category: string) {
  if (['illegal_content', 'security', 'privacy'].includes(category)) return 'urgent';
  if (['complaint', 'report', 'bug'].includes(category)) return 'high';
  return 'normal';
}
function scriptTypeValue(input: unknown) {
  const value = cleanText(input, 40);
  return ['emotional', 'comedy', 'horror', 'mechanism', 'faction'].includes(value) ? value : null;
}
function distributionTypeValue(input: unknown) {
  const value = cleanText(input, 40);
  return ['city_limited', 'boxed', 'exclusive'].includes(value) ? value : null;
}
function roleKindValue(input: unknown) {
  const value = cleanText(input, 40);
  return ['dm', 'field_control', 'npc', 'assistant', 'other'].includes(value) ? value : 'dm';
}
function roleKindLabel(value: unknown) {
  return ({
    dm: 'DM',
    field_control: '场控',
    npc: 'NPC',
    assistant: '助演',
    other: '其他',
  } as Record<string, string>)[cleanText(value, 40)] || 'DM';
}
function currentTenantId(req: any): string {
  return cleanText(req?.user?.tenantId, 80) || TENANT_ID;
}
async function requireTenantSchedule(req: any, res: any, scheduleId: string, select = 'id, tenant_id') {
  const { data, error } = await supabase.from('schedules').select(select).eq('id', scheduleId).eq('tenant_id', currentTenantId(req)).maybeSingle();
  if (error) throw error;
  if (!data) {
    res.status(404).json(err(new Error('排期不存在')));
    return null;
  }
  return data;
}
async function validateTenantActors(req: any, res: any, actorIds: string[]) {
  const ids = Array.from(new Set(actorIds.map(id => cleanText(id, 80)).filter(Boolean)));
  if (!ids.length) return true;
  const { data, error } = await supabase.from('actors').select('id').in('id', ids).eq('tenant_id', currentTenantId(req));
  if (error) throw error;
  if ((data || []).length !== ids.length) {
    res.status(404).json(err(new Error('存在不属于当前店家的卡司')));
    return false;
  }
  return true;
}
async function tenantIdFromRequest(req: any): Promise<string> {
  const direct = cleanText(req?.body?.tenantId || req?.query?.tenantId, 80);
  if (direct) return direct;
  const scheduleId = cleanText(req?.body?.scheduleId || req?.query?.scheduleId, 80);
  if (scheduleId) {
    const { data } = await supabase.from('schedules').select('tenant_id').eq('id', scheduleId).maybeSingle();
    if (data?.tenant_id) return data.tenant_id;
  }
  return TENANT_ID;
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
function publicScheduleStatus(status: unknown): string {
  const value = cleanText(status, 30);
  return value || 'pending';
}
function canPublicJoinSchedule(status: unknown): boolean {
  return ['pending', 'scheduled', 'confirmed'].includes(publicScheduleStatus(status));
}
function publicRoleKey(role: unknown): string {
  return cleanText(role, 80).toLowerCase();
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

function moneyCents(input: unknown): number {
  const value = Number(input || 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
function clockTime(input: unknown, fallback: string): string {
  const value = cleanText(input, 5);
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function boolValue(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

async function saveUploadDataUrl(dataUrl: unknown, folder: string) {
  const image = await sanitizeUploadedImageDataUrl(dataUrl);
  const result = await saveSanitizedUploadImage(image, folder, {
    env: process.env,
    localUploadRoot: LOCAL_UPLOAD_ROOT,
    cosTransport: COS_UPLOAD_TRANSPORT,
  });
  return result.url;
}

function scheduleSortKey(row: any) {
  return `${row.scheduled_date || ''}T${row.start_time || '00:00'}#${row.created_at || ''}#${row.id || ''}`;
}

async function computeCarSequenceMap(tenantId: string, scheduleRows: any[]) {
  const scriptIds = Array.from(new Set(scheduleRows.map(row => cleanText(row?.script_id, 80)).filter(Boolean)));
  const map = new Map<string, number>();
  if (!scriptIds.length) return map;
  const { data } = await supabase.from('schedules')
    .select('id, script_id, scheduled_date, start_time, created_at, store_car_sequence')
    .eq('tenant_id', tenantId)
    .in('script_id', scriptIds);
  const byScript = new Map<string, any[]>();
  for (const row of data || []) {
    const list = byScript.get(row.script_id) || [];
    list.push(row);
    byScript.set(row.script_id, list);
  }
  for (const list of byScript.values()) {
    list.sort((a, b) => scheduleSortKey(a).localeCompare(scheduleSortKey(b)));
    list.forEach((row, index) => {
      map.set(row.id, Number(row.store_car_sequence || 0) || index + 1);
    });
  }
  return map;
}

async function loadScheduleExternalData(tenantId: string, scheduleIds: string[]) {
  const empty = { npcMap: new Map<string, any[]>(), commissionMap: new Map<string, any[]>() };
  if (!scheduleIds.length) return empty;
  const [{ data: npcs }, { data: commissions }] = await Promise.all([
    supabase.from('schedule_external_npcs').select('*').eq('tenant_id', tenantId).in('schedule_id', scheduleIds).order('created_at', { ascending: true }),
    supabase.from('schedule_lingqi_commissions').select('*').eq('tenant_id', tenantId).in('schedule_id', scheduleIds).order('created_at', { ascending: true }),
  ]);
  const npcMap = new Map<string, any[]>();
  const commissionMap = new Map<string, any[]>();
  for (const row of npcs || []) {
    const list = npcMap.get(row.schedule_id) || [];
    list.push(row);
    npcMap.set(row.schedule_id, list);
  }
  for (const row of commissions || []) {
    const list = commissionMap.get(row.schedule_id) || [];
    list.push(row);
    commissionMap.set(row.schedule_id, list);
  }
  return { npcMap, commissionMap };
}

async function buildScheduleRatingSummary(tenantId: string, schedule: any) {
  const { data: scriptSchedules } = await supabase.from('schedules')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('script_id', schedule.script_id);
  const scheduleIds = (scriptSchedules || []).map((row: any) => row.id);
  if (!scheduleIds.length) return { carRating: null, carEvaluationCount: 0, scriptAvgRating: null, scriptEvaluationCount: 0 };
  const { data: allEvaluations } = await supabase.from('evaluations')
    .select('schedule_id, rating')
    .in('schedule_id', scheduleIds);
  const carRatings = (allEvaluations || [])
    .filter((row: any) => row.schedule_id === schedule.id)
    .map((row: any) => Number(row.rating || 0))
    .filter((rating: number) => rating > 0);
  const scriptRatings = (allEvaluations || [])
    .map((row: any) => Number(row.rating || 0))
    .filter((rating: number) => rating > 0);
  const avg = (ratings: number[]) => ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
  return {
    carRating: avg(carRatings),
    carEvaluationCount: carRatings.length,
    scriptAvgRating: avg(scriptRatings),
    scriptEvaluationCount: scriptRatings.length,
  };
}

function externalNpcPayload(row: any) {
  return {
    role_name: cleanText(row?.role_name, 120),
    provided_by: cleanText(row?.provided_by, 120) || null,
    note: cleanText(row?.note, 500) || null,
    photo_url: cleanText(row?.photo_url || row?.photoUrl, 500) || null,
    count_as_player: boolValue(row?.count_as_player ?? row?.countAsPlayer),
    count_in_settlement: boolValue(row?.count_in_settlement ?? row?.countInSettlement),
  };
}

function lingqiCommissionPayload(row: any) {
  return {
    lc_profile_id: cleanText(row?.lc_profile_id || row?.lcProfileId, 80) || null,
    display_name: cleanText(row?.display_name || row?.displayName, 120),
    avatar_url: cleanText(row?.avatar_url || row?.avatarUrl, 500) || null,
    role_name: cleanText(row?.role_name || row?.roleName, 120) || null,
    service_type: cleanText(row?.service_type || row?.serviceType, 40) || 'experience_support',
    status: ['pending', 'invited', 'accepted', 'confirmed', 'cancelled'].includes(cleanText(row?.status, 30)) ? cleanText(row?.status, 30) : 'pending',
    note: cleanText(row?.note, 500) || null,
  };
}

async function saveScheduleExternalData(req: any, scheduleId: string, tenantId: string, body: any) {
  if (Array.isArray(body.externalNpcs) || Array.isArray(body.external_npcs)) {
    const source = Array.isArray(body.externalNpcs) ? body.externalNpcs : body.external_npcs;
    const { error: deleteNpcErr } = await supabase.from('schedule_external_npcs').delete().eq('tenant_id', tenantId).eq('schedule_id', scheduleId);
    throwDbError(deleteNpcErr);
    const rows = source
      .map(externalNpcPayload)
      .filter((row: any) => row.role_name)
      .map((row: any) => ({ ...row, tenant_id: tenantId, schedule_id: scheduleId }));
    if (rows.length) {
      const { error: insertNpcErr } = await supabase.from('schedule_external_npcs').insert(rows);
      throwDbError(insertNpcErr);
    }
  }

  if (Array.isArray(body.lingqiCommissions) || Array.isArray(body.lingqi_commissions)) {
    const source = Array.isArray(body.lingqiCommissions) ? body.lingqiCommissions : body.lingqi_commissions;
    const { error: deleteCommissionErr } = await supabase.from('schedule_lingqi_commissions').delete().eq('tenant_id', tenantId).eq('schedule_id', scheduleId);
    throwDbError(deleteCommissionErr);
    const profileIds = source.map((row: any) => cleanText(row?.lc_profile_id || row?.lcProfileId, 80)).filter(Boolean);
    const profilesById = new Map<string, any>();
    if (profileIds.length) {
      const { data: profiles, error: profileErr } = await supabase.from('lc_profiles')
        .select('id, display_name, avatar, role_type, identity_roles, verified_dm, is_visible, is_banned')
        .in('id', profileIds);
      throwDbError(profileErr);
      for (const profile of profiles || []) profilesById.set(profile.id, profile);
    }
    const rows = source.map((raw: any) => {
      const row = lingqiCommissionPayload(raw);
      const profile = row.lc_profile_id ? profilesById.get(row.lc_profile_id) : null;
      return {
        ...row,
        display_name: row.display_name || profile?.display_name || '灵契师',
        avatar_url: row.avatar_url || profile?.avatar || null,
        tenant_id: tenantId,
        schedule_id: scheduleId,
      };
    }).filter((row: any) => row.display_name);
    if (rows.length) {
      const { error: insertCommissionErr } = await supabase.from('schedule_lingqi_commissions').insert(rows);
      throwDbError(insertCommissionErr);
    }
  }
}

function signedMoneyCents(input: unknown): number {
  const value = Number(input || 0);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

async function createCustomerTransactionOnPostgres(input: {
  tenantId: string;
  customerId: string;
  transactionType: string;
  amount: number;
  bonusAmount: number;
  lockDmCredits: number;
  paymentMethod: string | null;
  packageId: string | null;
  scheduleId: string | null;
  note: string | null;
  idempotencyKey: string;
}) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    if (input.idempotencyKey) {
      const existing = await client.query(
        `select * from membership_transactions where idempotency_key = $1 for update`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (String(existing.rows[0].customer_id) !== input.customerId) throw new Error('重复请求标识已被其他交易使用');
        await client.query('COMMIT');
        return existing.rows[0];
      }
    }

    const customerResult = await client.query(
      `select * from customers where id = $1 and tenant_id = $2 for update`,
      [input.customerId, input.tenantId],
    );
    const customer = customerResult.rows[0];
    if (!customer) throw new Error('客户不存在');

    let amount = input.amount;
    let bonusAmount = input.bonusAmount;
    let lockDmCredits = input.lockDmCredits;
    let packageRow: any = null;
    if (input.packageId) {
      const packageResult = await client.query(
        `select * from jzg_membership_packages where id = $1 and tenant_id = $2 and is_active = true`,
        [input.packageId, input.tenantId],
      );
      packageRow = packageResult.rows[0];
      if (!packageRow) throw new Error('套餐不存在或已停用');
      amount = moneyCents(packageRow.recharge_amount);
      bonusAmount = moneyCents(packageRow.bonus_amount);
      lockDmCredits = moneyCents(packageRow.lock_dm_credits);
    }
    if (input.scheduleId) {
      const scheduleResult = await client.query(
        `select id from schedules where id = $1 and tenant_id = $2`,
        [input.scheduleId, input.tenantId],
      );
      if (!scheduleResult.rows[0]) throw new Error('排期不存在');
    }

    let balanceDelta = 0;
    let bonusDelta = 0;
    let lockDmDelta = 0;
    let balance = Number(customer.balance || 0);
    let bonusBalance = Number(customer.bonus_balance || 0);
    let lockDmBalance = Number(customer.lock_dm_credits || 0);
    let totalRecharged = Number(customer.total_recharged || 0);
    let totalConsumed = Number(customer.total_consumed || 0);
    let totalBonusGranted = Number(customer.total_bonus_granted || 0);
    let totalLockDmGranted = Number(customer.total_lock_dm_granted || 0);

    if (input.transactionType === 'recharge') {
      if (amount <= 0) throw new Error('充值金额必须大于 0');
      balanceDelta = amount + bonusAmount;
      bonusDelta = bonusAmount;
      lockDmDelta = lockDmCredits;
      balance += balanceDelta;
      bonusBalance += bonusDelta;
      lockDmBalance += lockDmDelta;
      totalRecharged += amount;
      totalBonusGranted += bonusDelta;
      totalLockDmGranted += lockDmDelta;
    } else if (input.transactionType === 'consume') {
      if (amount <= 0) throw new Error('消费金额必须大于 0');
      balanceDelta = -amount;
      balance += balanceDelta;
      totalConsumed += amount;
    } else if (input.transactionType === 'refund') {
      if (amount <= 0) throw new Error('退款金额必须大于 0');
      balanceDelta = amount;
      balance += balanceDelta;
    } else if (input.transactionType === 'adjust') {
      balanceDelta = amount;
      bonusDelta = input.bonusAmount;
      lockDmDelta = input.lockDmCredits;
      balance += balanceDelta;
      bonusBalance += bonusDelta;
      lockDmBalance += lockDmDelta;
    } else {
      throw new Error('交易类型无效');
    }
    if (balance < 0) throw new Error('余额不足，不能完成本次交易');
    if (bonusBalance < 0) throw new Error('赠送余额不足，不能完成本次调整');
    if (lockDmBalance < 0) throw new Error('锁 DM 权益不足，不能完成本次调整');

    await client.query(
      `update customers
          set balance = $3, bonus_balance = $4, lock_dm_credits = $5,
              total_recharged = $6, total_consumed = $7,
              total_bonus_granted = $8, total_lock_dm_granted = $9,
              updated_at = now()
        where id = $1 and tenant_id = $2`,
      [
        input.customerId,
        input.tenantId,
        balance,
        bonusBalance,
        lockDmBalance,
        totalRecharged,
        totalConsumed,
        totalBonusGranted,
        totalLockDmGranted,
      ],
    );
    const transactionResult = await client.query(
      `insert into membership_transactions
        (customer_id, schedule_id, amount, transaction_type, note,
         balance_delta, bonus_delta, lock_dm_delta, payment_method,
         package_id, metadata, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       returning *`,
      [
        input.customerId,
        input.scheduleId,
        amount,
        input.transactionType,
        input.note,
        balanceDelta,
        bonusDelta,
        lockDmDelta,
        input.paymentMethod,
        packageRow?.id || null,
        JSON.stringify(packageRow ? { package_name: packageRow.name } : {}),
        input.idempotencyKey || null,
      ],
    );
    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateDmAssignmentOnPostgres(input: {
  tenantId: string;
  scheduleId: string;
  mode: 'assign' | 'request' | 'clear' | 'not_needed';
  customerId?: string | null;
  actorId?: string | null;
  roleName?: string | null;
  checkinId?: string | null;
}) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    const scheduleResult = await client.query(
      `select * from schedules where id = $1 and tenant_id = $2 for update`,
      [input.scheduleId, input.tenantId],
    );
    const schedule = scheduleResult.rows[0];
    if (!schedule) throw new Error('排期不存在');
    if (['cancelled', 'bombed', 'completed'].includes(schedule.status)) throw new Error('当前状态不能指定 DM');
    if (input.mode === 'request' && !['locked', 'confirmed', 'ongoing', 'settling'].includes(schedule.status)) {
      throw new Error('锁车后才能指定 DM');
    }

    const customerIds = [...new Set([
      schedule.dm_lock_customer_id,
      input.customerId,
    ].filter(Boolean).map(String))].sort();
    const customersResult = customerIds.length
      ? await client.query(
        `select * from customers where tenant_id = $1 and id = any($2::uuid[]) order by id for update`,
        [input.tenantId, customerIds],
      )
      : { rows: [] as any[] };
    const customers = new Map<string, any>(customersResult.rows.map((row: any) => [String(row.id), row]));

    const sameAssignment = input.mode !== 'clear'
      && input.mode !== 'not_needed'
      && String(schedule.dm_lock_customer_id || '') === String(input.customerId || '')
      && String(schedule.requested_dm_actor_id || '') === String(input.actorId || '')
      && String(schedule.requested_dm_role_name || '') === String(input.roleName || '')
      && Boolean(schedule.dm_lock_credit_transaction_id);
    if (sameAssignment) {
      await client.query('COMMIT');
      return schedule;
    }

    if (schedule.dm_lock_customer_id && schedule.dm_lock_credit_transaction_id) {
      const oldCustomer = customers.get(String(schedule.dm_lock_customer_id));
      if (!oldCustomer) throw new Error('原锁 DM 权益所属会员不存在，请先修复会员关联');
      await client.query(
        `update customers
            set lock_dm_credits = coalesce(lock_dm_credits, 0) + 1,
                total_lock_dm_used = greatest(0, coalesce(total_lock_dm_used, 0) - 1),
                updated_at = now()
          where id = $1 and tenant_id = $2`,
        [oldCustomer.id, input.tenantId],
      );
      await client.query(
        `insert into membership_transactions
          (customer_id, schedule_id, amount, transaction_type, note,
           balance_delta, bonus_delta, lock_dm_delta, metadata, idempotency_key)
         values ($1, $2, 0, 'lock_dm_refund', $3, 0, 0, 1, $4::jsonb, $5)
         on conflict (idempotency_key) where idempotency_key is not null do nothing`,
        [
          oldCustomer.id,
          schedule.id,
          `取消指定卡司，退回锁卡司次数：${schedule.requested_dm_role_name || '未记录角色'}`,
          JSON.stringify({
            actor_id: schedule.requested_dm_actor_id,
            role_name: schedule.requested_dm_role_name,
            refund_for_transaction_id: schedule.dm_lock_credit_transaction_id,
          }),
          `dm-lock-refund:${schedule.dm_lock_credit_transaction_id}`,
        ],
      );
    }

    if (input.mode === 'clear' || input.mode === 'not_needed') {
      const cleared = await client.query(
        `update schedules
            set dm_lock_customer_id = null,
                requested_dm_actor_id = null,
                requested_dm_role_name = null,
                dm_lock_status = $3,
                dm_lock_credit_transaction_id = null
          where id = $1 and tenant_id = $2
          returning *`,
        [schedule.id, input.tenantId, input.mode === 'not_needed' ? 'not_needed' : 'none'],
      );
      await client.query('COMMIT');
      return cleared.rows[0];
    }

    if (!input.customerId || !input.actorId) throw new Error('请选择会员和 DM');
    const customer = customers.get(String(input.customerId));
    if (!customer) throw new Error('玩家会员不存在');
    if (Number(customer.lock_dm_credits || 0) <= 0) throw new Error('该玩家没有可用锁卡司次数，请先充卡或调整权益');
    await client.query(
      `update customers
          set lock_dm_credits = coalesce(lock_dm_credits, 0) - 1,
              total_lock_dm_used = coalesce(total_lock_dm_used, 0) + 1,
              updated_at = now()
        where id = $1 and tenant_id = $2`,
      [customer.id, input.tenantId],
    );
    const transactionResult = await client.query(
      `insert into membership_transactions
        (customer_id, schedule_id, amount, transaction_type, note,
         balance_delta, bonus_delta, lock_dm_delta, metadata)
       values ($1, $2, 0, 'lock_dm', $3, 0, 0, -1, $4::jsonb)
       returning id`,
      [
        customer.id,
        schedule.id,
        input.roleName ? `指定卡司：${input.roleName}` : '指定 DM 权益使用',
        JSON.stringify({ actor_id: input.actorId, role_name: input.roleName || null, checkin_id: input.checkinId || null }),
      ],
    );
    const updated = await client.query(
      `update schedules
          set dm_lock_customer_id = $3,
              requested_dm_actor_id = $4,
              requested_dm_role_name = $5,
              dm_lock_status = $6,
              dm_lock_credit_transaction_id = $7
        where id = $1 and tenant_id = $2
        returning *`,
      [
        schedule.id,
        input.tenantId,
        customer.id,
        input.actorId,
        input.roleName || null,
        input.mode === 'request' ? 'requested' : 'confirmed',
        transactionResult.rows[0].id,
      ],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function buildScheduleProgress(schedule: any, checkins: any[], playerRoles: any[], evaluations: any[] = []) {
  const targetCount = Number(schedule?.player_count || 0) || playerRoles.length || 0;
  const boardedCount = checkins.length;
  const depositRequired = checkins.filter((item: any) => item.deposit_status !== 'waived' && item.deposit_status !== 'refunded').length;
  const depositReady = checkins.filter((item: any) => ['paid', 'waived'].includes(item.deposit_status || '')).length;
  const settledCount = checkins.filter((item: any) => item.settlement_status === 'settled' || item.final_paid_at).length;
  const finalTotal = checkins.reduce((sum: number, item: any) => sum + Number(item.final_amount || 0), 0);
  const depositTotal = checkins.reduce((sum: number, item: any) => sum + Number(item.deposit_amount || 0), 0);
  const ratings = evaluations.map((item: any) => Number(item.rating || 0)).filter((rating: number) => rating > 0);
  const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const steps = [
    { key: 'boarding', label: '组车', done: boardedCount > 0 },
    { key: 'deposit', label: '定金', done: boardedCount > 0 && depositReady >= Math.max(1, depositRequired) },
    { key: 'locked', label: '锁车', done: ['locked', 'confirmed', 'ongoing', 'settling', 'completed'].includes(schedule.status) },
    { key: 'dm', label: '指定DM', done: schedule.dm_lock_status === 'confirmed' || schedule.dm_lock_status === 'not_needed', optional: true },
    { key: 'started', label: '开本', done: ['ongoing', 'settling', 'completed'].includes(schedule.status) },
    { key: 'settled', label: '结算', done: schedule.status === 'completed' || (boardedCount > 0 && settledCount >= boardedCount) },
  ];
  return {
    targetCount,
    boardedCount,
    isFull: targetCount > 0 && boardedCount >= targetCount,
    depositRequired,
    depositReady,
    unsettledCount: Math.max(0, boardedCount - settledCount),
    settledCount,
    depositTotal,
    finalTotal,
    paymentBreakdown: checkins.reduce((acc: Record<string, number>, item: any) => {
      const key = item.final_payment_method || 'unknown';
      acc[key] = (acc[key] || 0) + Number(item.final_amount || 0);
      return acc;
    }, {}),
    evaluationCount: evaluations.length,
    avgRating,
    steps,
    stepDoneCount: steps.filter(step => step.done && !step.optional).length + steps.filter(step => step.done && step.optional).length,
  };
}

function depositSettlementMode(input: unknown): 'deduct_final' | 'refund_after_full' | 'custom' {
  const value = cleanText(input, 40);
  if (value === 'refund_after_full') return 'refund_after_full';
  if (value === 'custom') return 'custom';
  return 'deduct_final';
}

function actorGender(input: unknown) {
  const value = cleanText(input, 20);
  return ['男', '女', '可男可女'].includes(value) ? value : null;
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
  if (/来源[：:]\s*(?:灵契|剧幕录)拼车区|拼车ID[：:]/.test(text)) return false;
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
    needed_count: Math.min(20, Math.max(1, Number(schedule.player_count || 0) || neededRoles.length || 1)),
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
    impersonating: !!user.impersonating,
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
  if (user?.display_name) payload.displayName = user.display_name;
  if (user?.impersonating) payload.impersonating = true;
  payload.sessionVersion = Number(user?.session_version || 1);
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
async function logStoreAction(req: any, action: string, target?: { type?: string; id?: unknown; label?: unknown }, detail?: Record<string, any>) {
  try {
    const actor = await getAdminUserById(req.user?.adminUserId);
    await supabase.from('jzg_store_operation_logs').insert({
      tenant_id: currentTenantId(req),
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
    console.warn('[store-operation-log-failed]', err(logErr).error);
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
function parseRole(role: any): { role_name: string; gender: string; role_kind?: string } {
  if (role && typeof role === 'object') {
    return {
      role_name: cleanText(role.name || role.role_name, 80),
      gender: cleanText(role.gender, 40),
      role_kind: role.role_kind !== undefined || role.kind !== undefined ? roleKindValue(role.role_kind || role.kind) : undefined,
    };
  }
  const text = cleanText(role, 120);
  const m = text.match(/^(.+?)\s*\((.*?)\)$/);
  return { role_name: m ? m[1].trim() : text, gender: m?.[2]?.trim() || '' };
}

function serializeRoles(rows: any[] | null | undefined) {
  return (rows || []).map((r: any) => ({
    role_name: r.role_name,
    gender: r.gender || '',
    role_kind: r.role_kind || 'dm',
    tags: Array.isArray(r.tags) ? r.tags : [],
  }));
}

function roleNameKey(name: any) {
  return cleanText(name, 120).toLowerCase();
}

function roleSetKey(roles: any[] | null | undefined) {
  return (roles || [])
    .map((role: any) => {
      const roleName = typeof role === 'string' ? role : role?.role_name || role?.name;
      if (!roleNameKey(roleName)) return '';
      const gender = typeof role === 'string' ? '' : cleanText(role?.gender, 40);
      return `${roleNameKey(roleName)}@${gender}`;
    })
    .filter(Boolean)
    .sort()
    .join('|');
}

function serializeBoards(rows: any[] | null | undefined) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .slice()
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((board: any, index: number) => ({
      id: board.id,
      name: cleanText(board.name, 80) || (index === 0 ? '标准版' : `板子${index + 1}`),
      player_count: board.player_count === null || board.player_count === undefined ? null : Number(board.player_count),
      notes: cleanText(board.notes, 500) || '',
      is_default: board.is_default === true,
      sort_order: Number(board.sort_order || index),
      roles: (board.script_board_actor_roles || board.roles || [])
        .slice()
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((role: any) => ({
          role_name: cleanText(role.role_name || role.name, 120),
          gender: cleanText(role.gender, 40) || '',
          role_kind: roleKindValue(role.role_kind || role.kind),
        }))
        .filter((role: any) => role.role_name),
      player_roles: (board.script_board_player_roles || board.player_roles || [])
        .slice()
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((role: any) => ({
          role_name: cleanText(role.role_name || role.name, 120),
          gender: cleanText(role.gender, 40) || '',
        }))
        .filter((role: any) => role.role_name),
    }));
}

function uuidValue(value: unknown) {
  const text = cleanText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : '';
}

function sharedLibraryTokenMatches(req: any) {
  const provided = cleanText(req.headers['x-shared-library-token'], 500);
  if (!SHARED_SCRIPT_LIBRARY_TOKEN || !provided) return false;
  const expectedBuffer = Buffer.from(SHARED_SCRIPT_LIBRARY_TOKEN);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function requireSharedLibraryToken(req: any, res: any) {
  if (!SHARED_SCRIPT_LIBRARY_TOKEN) {
    res.status(503).json(err(new Error('共享剧本库服务密钥未配置')));
    return false;
  }
  if (!sharedLibraryTokenMatches(req)) {
    res.status(401).json(err(new Error('共享剧本库服务认证失败')));
    return false;
  }
  return true;
}

function sharedTemplateFields(input: any) {
  const name = cleanText(input?.name, 160);
  const playerRoles = normalizeSharedRoles(input?.player_roles ?? input?.playerRoles, 'player');
  const actorRoles = normalizeSharedRoles(input?.actor_roles ?? input?.actorRoles, 'actor');
  const boards = Array.isArray(input?.boards) ? input.boards : [];
  const optionalNumber = (value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  return {
    name,
    canonical_key: normalizeSharedScriptKey(name),
    duration_minutes: optionalNumber(input?.duration_minutes ?? input?.durationMinutes),
    min_duration_hours: optionalNumber(input?.min_duration_hours ?? input?.minDurationHours),
    max_duration_hours: optionalNumber(input?.max_duration_hours ?? input?.maxDurationHours),
    dm_gender: cleanText(input?.dm_gender ?? input?.dmGender, 40) || null,
    player_count: optionalNumber(input?.player_count ?? input?.playerCount) || (playerRoles.length || null),
    player_selection_rule: cleanText(input?.player_selection_rule ?? input?.playerSelectionRule, 300) || null,
    player_roles: playerRoles,
    actor_roles: actorRoles,
    boards,
    credits: normalizeSharedCredits(input?.credits),
  };
}

async function findApprovedSharedTemplate(idInput: unknown, nameInput?: unknown) {
  const id = uuidValue(idInput);
  if (id) {
    const byId = await supabase.from('jzg_script_templates').select('*').eq('id', id).eq('review_status', 'approved').maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return byId.data;
  }
  const canonicalKey = normalizeSharedScriptKey(nameInput);
  if (!canonicalKey) return null;
  const byKey = await supabase.from('jzg_script_templates').select('*').eq('canonical_key', canonicalKey).eq('review_status', 'approved').maybeSingle();
  if (byKey.error) throw byKey.error;
  return byKey.data || null;
}

async function upsertApprovedSharedTemplate(input: any) {
  const fields = sharedTemplateFields(input);
  if (!fields.name || !fields.canonical_key) throw new Error('请填写剧本名称');
  const existing = await findApprovedSharedTemplate(input?.id ?? input?.script_id ?? input?.scriptId, fields.name);
  const now = new Date().toISOString();
  if (existing) {
    const merged = {
      name: fields.name || existing.name,
      canonical_key: normalizeSharedScriptKey(fields.name || existing.name),
      duration_minutes: fields.duration_minutes || existing.duration_minutes || 240,
      min_duration_hours: fields.min_duration_hours || existing.min_duration_hours || 4,
      max_duration_hours: fields.max_duration_hours || existing.max_duration_hours || 4,
      dm_gender: fields.dm_gender || existing.dm_gender || '未指定',
      player_count: Math.max(Number(existing.player_count || 0), Number(fields.player_count || 0), fields.player_roles.length),
      player_selection_rule: fields.player_selection_rule || existing.player_selection_rule || null,
      player_roles: mergeSharedRoles(existing.player_roles, fields.player_roles, 'player'),
      actor_roles: mergeSharedRoles(existing.actor_roles, fields.actor_roles, 'actor'),
      boards: fields.boards.length ? fields.boards : (Array.isArray(existing.boards) ? existing.boards : []),
      credits: mergeSharedCredits(existing.credits, fields.credits),
      source_system: cleanText(input?.source_system ?? input?.sourceSystem, 40) || existing.source_system || null,
      source_record_id: cleanText(input?.source_record_id ?? input?.sourceRecordId, 120) || existing.source_record_id || null,
      updated_at: now,
    };
    const updated = await supabase.from('jzg_script_templates').update(merged).eq('id', existing.id).select('*').single();
    if (updated.error) throw updated.error;
    return updated.data;
  }

  const inserted = await supabase.from('jzg_script_templates').insert({
    ...fields,
    duration_minutes: fields.duration_minutes || 240,
    min_duration_hours: fields.min_duration_hours || 4,
    max_duration_hours: fields.max_duration_hours || 4,
    dm_gender: fields.dm_gender || '未指定',
    player_count: Math.max(1, Number(fields.player_count || fields.player_roles.length || 1)),
    source_script_id: uuidValue(input?.source_script_id ?? input?.sourceScriptId) || null,
    source_tenant_id: uuidValue(input?.source_tenant_id ?? input?.sourceTenantId) || null,
    source_system: cleanText(input?.source_system ?? input?.sourceSystem, 40) || null,
    source_record_id: cleanText(input?.source_record_id ?? input?.sourceRecordId, 120) || null,
    usage_count: 0,
    created_by: cleanText(input?.created_by ?? input?.createdBy, 160) || '共享剧本库',
    review_status: 'approved',
    reviewed_at: now,
    reviewed_by: uuidValue(input?.reviewed_by ?? input?.reviewedBy) || null,
    reject_reason: null,
    updated_at: now,
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function ensureTenantScriptFromSharedTemplate(templateIdInput: unknown, tenantId: string, fallbackNameInput: unknown, fallbackRolesInput: unknown) {
  const template = await findApprovedSharedTemplate(templateIdInput, fallbackNameInput);
  const name = cleanText(template?.name || fallbackNameInput, 160);
  if (!name) throw new Error('缺少剧本名称');
  const existing = await supabase.from('scripts').select('id,name').eq('tenant_id', tenantId).eq('name', name).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { script: existing.data, template, existing: true };

  const playerRoles = template
    ? normalizeSharedRoles(template.player_roles, 'player')
    : normalizeSharedRoles(fallbackRolesInput, 'player');
  const actorRoles = template ? normalizeSharedRoles(template.actor_roles, 'actor') : [];
  const created = await supabase.from('scripts').insert({
    name,
    duration_minutes: Number(template?.duration_minutes || 240),
    min_duration_hours: Number(template?.min_duration_hours || 4),
    max_duration_hours: Number(template?.max_duration_hours || 4),
    player_count: Math.max(1, Number(template?.player_count || playerRoles.length || 1)),
    player_selection_rule: cleanText(template?.player_selection_rule, 300) || null,
    tenant_id: tenantId,
  }).select('*').single();
  if (created.error) throw created.error;
  if (playerRoles.length) {
    const roleInsert = await supabase.from('script_player_roles').insert(playerRoles.map(role => ({
      script_id: created.data.id,
      role_name: role.role_name,
      gender: role.gender || '',
    })));
    if (roleInsert.error) throw roleInsert.error;
  }
  if (actorRoles.length) {
    const actorInsert = await supabase.from('script_actor_roles').insert(actorRoles.map(role => ({
      script_id: created.data.id,
      role_name: role.role_name,
      gender: role.gender || '',
      role_kind: roleKindValue(role.role_kind),
    })));
    if (actorInsert.error) throw actorInsert.error;
  }
  await saveScriptBoards(
    created.data.id,
    Array.isArray(template?.boards) ? template.boards : [],
    actorRoles,
    playerRoles,
    Math.max(1, Number(template?.player_count || playerRoles.length || 1)),
  );
  return { script: created.data, template, existing: false };
}

function playerSelectionSummary(script: any, candidateCount?: number) {
  const rule = cleanText(script?.player_selection_rule, 300);
  if (rule) return rule;
  const players = Number(script?.player_count || 0);
  const candidates = Number(candidateCount || script?.role_count || 0);
  if (players && candidates > players) return `${candidates}选${players}`;
  if (players) return `${players}人本`;
  return '';
}

function normalizeScriptApiRecord(script: any) {
  const playerRows = script.script_player_roles || [];
  const actorRows = script.script_actor_roles || [];
  const roleCount = playerRows.length || Number(script.role_count || 0);
  const playerCount = Number(script.player_count || roleCount || 0);
  const boards = serializeBoards(script.script_boards);
  script.player_roles = playerRows.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
  script.actor_role_details = actorRows.map((r: any) => ({ name: r.role_name, gender: r.gender || '', role_kind: r.role_kind || 'dm' }));
  script.actor_roles = actorRows.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
  script.role_count = roleCount;
  script.candidate_player_count = roleCount;
  script.player_count = playerCount;
  script.actor_count = actorRows.length || Number(script.actor_count || 0);
  script.selection_summary = playerSelectionSummary(script, roleCount);
  script.boards = boards.length ? boards : [{
    name: '标准版',
    player_count: playerCount || null,
    notes: '',
    is_default: true,
    sort_order: 0,
    roles: actorRows.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '', role_kind: roleKindValue(role.role_kind) })),
    player_roles: playerRows.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '' })),
  }];
  script.duration = script.duration_minutes || 0;
  script.min_duration = script.min_duration_hours ? Math.round(script.min_duration_hours * 60) : 0;
  script.max_duration = script.max_duration_hours ? Math.round(script.max_duration_hours * 60) : 0;
  delete script.script_player_roles;
  delete script.script_actor_roles;
  delete script.script_boards;
  return script;
}

function normalizeBoardPayload(boards: any[] | null | undefined, actorRoles: any[] | null | undefined, playerRoles: any[] | null | undefined, playerCount: number) {
  let boardSource = boards;
  if (!Array.isArray(boardSource) && typeof boardSource === 'string') {
    try { boardSource = JSON.parse(boardSource); } catch { boardSource = []; }
  }
  const actorRows = (actorRoles || []).map(parseRole).filter((role: any) => role.role_name);
  const playerRows = (playerRoles || []).map(parseRole).filter((role: any) => role.role_name);
  const roleByName = new Map(actorRows.map((role: any) => [roleNameKey(role.role_name), role]));
  const playerRoleByName = new Map(playerRows.map((role: any) => [roleNameKey(role.role_name), role]));
  const source = Array.isArray(boardSource) && boardSource.length
    ? boardSource
    : [{ name: '标准版', player_count: playerCount || null, is_default: true, roles: actorRows, player_roles: playerRows }];
  const normalized = source.map((board: any, index: number) => {
    const rawRoles = Array.isArray(board?.roles) ? board.roles : [];
    const roles = rawRoles
      .map((role: any) => {
        const roleName = cleanText(typeof role === 'string' ? role : role?.role_name || role?.name, 120);
        if (!roleName) return null;
        const key = roleNameKey(roleName);
        if (roleByName.size && !roleByName.has(key)) return null;
        const baseRole = roleByName.get(key);
        return {
          role_name: roleName,
          gender: cleanText(typeof role === 'object' ? role.gender : '', 40) || baseRole?.gender || '',
          role_kind: roleKindValue((typeof role === 'object' ? role.role_kind || role.kind : '') || baseRole?.role_kind),
        };
      })
      .filter(Boolean) as { role_name: string; gender: string; role_kind: string }[];
    const rawPlayerRoles = Array.isArray(board?.player_roles || board?.playerRoles) ? (board.player_roles || board.playerRoles) : [];
    const playerRoles = rawPlayerRoles
      .map((role: any) => {
        const roleName = cleanText(typeof role === 'string' ? role : role?.role_name || role?.name, 120);
        if (!roleName) return null;
        const key = roleNameKey(roleName);
        if (playerRoleByName.size && !playerRoleByName.has(key)) return null;
        const baseRole = playerRoleByName.get(key);
        return {
          role_name: roleName,
          gender: cleanText(typeof role === 'object' ? role.gender : '', 40) || baseRole?.gender || '',
        };
      })
      .filter((role: any) => role.role_name);
    const fallbackRoles = index === 0 && !roles.length ? actorRows.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '', role_kind: roleKindValue(role.role_kind) })) : roles;
    const fallbackPlayerRoles = index === 0 && !playerRoles.length ? playerRows.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '' })) : playerRoles;
    return {
      id: cleanText(board?.id, 80) || null,
      name: cleanText(board?.name, 80) || (index === 0 ? '标准版' : `板子${index + 1}`),
      player_count: board?.player_count ?? board?.playerCount ?? playerCount ?? null,
      notes: cleanText(board?.notes, 500) || null,
      is_default: board?.is_default === true || board?.isDefault === true,
      sort_order: Number(board?.sort_order ?? board?.sortOrder ?? index),
      roles: fallbackRoles,
      player_roles: fallbackPlayerRoles,
    };
  });
  if (normalized.length && !normalized.some(board => board.is_default)) normalized[0].is_default = true;
  let hasDefault = false;
  for (const board of normalized) {
    if (board.is_default && !hasDefault) {
      hasDefault = true;
    } else if (board.is_default) {
      board.is_default = false;
    }
  }
  return normalized;
}

async function fetchScriptBoards(scriptId: string) {
  const { data, error } = await supabase.from('script_boards')
    .select('id, name, player_count, notes, is_default, sort_order, script_board_actor_roles(role_name, gender, role_kind, sort_order), script_board_player_roles(role_name, gender, sort_order)')
    .eq('script_id', scriptId)
    .order('sort_order');
  if (error) throw error;
  return serializeBoards(data || []);
}

async function saveScriptBoards(scriptId: string, boards: any[] | null | undefined, actorRoles: any[] | null | undefined, playerRoles: any[] | null | undefined, playerCount: number) {
  const normalizedBoards = normalizeBoardPayload(boards, actorRoles, playerRoles, playerCount);
  const { data: existingBoards } = await supabase.from('script_boards').select('id').eq('script_id', scriptId);
  const existingIds = new Set((existingBoards || []).map((board: any) => board.id));
  const incomingIds = new Set(normalizedBoards.map(board => board.id).filter(Boolean));
  for (const board of existingBoards || []) {
    if (!incomingIds.has(board.id)) await supabase.from('script_boards').delete().eq('id', board.id).eq('script_id', scriptId);
  }
  await supabase.from('script_boards').update({ is_default: false, updated_at: new Date().toISOString() }).eq('script_id', scriptId);
  const savedBoards = [];
  for (const [index, board] of normalizedBoards.entries()) {
    const payload = {
      script_id: scriptId,
      name: board.name,
      player_count: board.player_count ? Number(board.player_count) : null,
      notes: board.notes || null,
      is_default: board.is_default === true,
      sort_order: Number(board.sort_order || index),
      updated_at: new Date().toISOString(),
    };
    let saved: any = null;
    if (board.id && existingIds.has(board.id)) {
      const { data, error } = await supabase.from('script_boards')
        .update(payload)
        .eq('id', board.id)
        .eq('script_id', scriptId)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('script_boards')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    }
    await supabase.from('script_board_actor_roles').delete().eq('board_id', saved.id);
    if (board.roles.length) {
      await supabase.from('script_board_actor_roles').insert(board.roles.map((role: any, roleIndex: number) => ({
        board_id: saved.id,
        role_name: role.role_name,
        gender: role.gender || '',
        role_kind: roleKindValue(role.role_kind),
        sort_order: roleIndex,
      })));
    }
    await supabase.from('script_board_player_roles').delete().eq('board_id', saved.id);
    if (board.player_roles.length) {
      await supabase.from('script_board_player_roles').insert(board.player_roles.map((role: any, roleIndex: number) => ({
        board_id: saved.id,
        role_name: role.role_name,
        gender: role.gender || '',
        sort_order: roleIndex,
      })));
    }
    savedBoards.push({ ...saved, roles: board.roles, player_roles: board.player_roles });
  }
  return savedBoards;
}

function normalizeActorRoleSelectionInput(input: any[] | null | undefined, actorRoleRows: any[] | null | undefined) {
  let source = input;
  if (!Array.isArray(source) && typeof source === 'string') {
    try { source = JSON.parse(source); } catch { source = []; }
  }
  const roleByName = new Map((actorRoleRows || []).map((role: any) => [roleNameKey(role.role_name || role.name), role]));
  return (Array.isArray(source) ? source : [])
    .map((role: any) => {
      const roleName = cleanText(typeof role === 'string' ? role : role?.role_name || role?.name, 120);
      if (!roleName) return null;
      const key = roleNameKey(roleName);
      if (roleByName.size && !roleByName.has(key)) return null;
      const baseRole = roleByName.get(key);
      return {
        role_name: roleName,
        gender: cleanText(typeof role === 'object' ? role.gender : '', 40) || baseRole?.gender || '',
        role_kind: roleKindValue((typeof role === 'object' ? role.role_kind || role.kind : '') || baseRole?.role_kind),
      };
    })
    .filter(Boolean) as { role_name: string; gender: string; role_kind: string }[];
}

function normalizePlayerRoleSelectionInput(input: any[] | null | undefined, playerRoleRows: any[] | null | undefined) {
  let source = input;
  if (!Array.isArray(source) && typeof source === 'string') {
    try { source = JSON.parse(source); } catch { source = []; }
  }
  const roleByName = new Map((playerRoleRows || []).map((role: any) => [roleNameKey(role.role_name || role.name), role]));
  return (Array.isArray(source) ? source : [])
    .map((role: any) => {
      const roleName = cleanText(typeof role === 'string' ? role : role?.role_name || role?.name, 120);
      if (!roleName) return null;
      const key = roleNameKey(roleName);
      if (roleByName.size && !roleByName.has(key)) return null;
      const baseRole = roleByName.get(key);
      return {
        role_name: roleName,
        gender: cleanText(typeof role === 'object' ? role.gender : '', 40) || baseRole?.gender || '',
      };
    })
    .filter(Boolean) as { role_name: string; gender: string }[];
}

async function resolveScheduleRoleSelection(scriptId: string, requestedBoardId?: string | null, requestedRoles?: any[] | null, requestedPlayerRoles?: any[] | null) {
  const { data: actorRows, error: actorErr } = await supabase.from('script_actor_roles')
    .select('role_name, gender, role_kind')
    .eq('script_id', scriptId);
  if (actorErr) throw actorErr;
  const { data: playerRows, error: playerErr } = await supabase.from('script_player_roles')
    .select('role_name, gender')
    .eq('script_id', scriptId);
  if (playerErr) throw playerErr;
  const actorRoles = actorRows || [];
  const playerRoles = playerRows || [];
  const boards = await fetchScriptBoards(scriptId);
  let selection = normalizeActorRoleSelectionInput(requestedRoles || [], actorRoles);
  let playerSelection = normalizePlayerRoleSelectionInput(requestedPlayerRoles || [], playerRoles);
  let board = requestedBoardId ? boards.find(item => item.id === requestedBoardId) || null : null;
  if (!selection.length && board) selection = board.roles.map(role => ({ role_name: role.role_name, gender: role.gender || '', role_kind: roleKindValue(role.role_kind) }));
  if (!playerSelection.length && board) playerSelection = (board.player_roles || []).map(role => ({ role_name: role.role_name, gender: role.gender || '' }));
  if (!selection.length) {
    board = boards.find(item => item.is_default) || boards[0] || null;
    if (board) selection = board.roles.map(role => ({ role_name: role.role_name, gender: role.gender || '', role_kind: roleKindValue(role.role_kind) }));
  }
  if (!playerSelection.length) {
    if (!board) board = boards.find(item => item.is_default) || boards[0] || null;
    if (board) playerSelection = (board.player_roles || []).map(role => ({ role_name: role.role_name, gender: role.gender || '' }));
  }
  if (!selection.length) selection = actorRoles.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '', role_kind: roleKindValue(role.role_kind) }));
  if (!playerSelection.length) playerSelection = playerRoles.map((role: any) => ({ role_name: role.role_name, gender: role.gender || '' }));
  const selectionKey = roleSetKey(selection);
  const playerSelectionKey = roleSetKey(playerSelection);
  const matchedBoard = boards.find(item => roleSetKey(item.roles) === selectionKey && roleSetKey(item.player_roles || []) === playerSelectionKey) || board;
  return {
    board: matchedBoard || null,
    roles: selection,
    playerRoles: playerSelection,
  };
}

async function publishScriptRowsAsTemplates(scripts: any[], createdBy: string, reviewStatus: 'pending' | 'approved' = 'pending', reviewedBy?: string | null) {
  const now = new Date().toISOString();
  const rows = (scripts || []).map((s: any) => ({
    source_script_id: s.id,
    source_tenant_id: s.tenant_id || TENANT_ID,
    name: s.name,
    canonical_key: normalizeSharedScriptKey(s.name),
    duration_minutes: s.duration_minutes || s.duration || 240,
    min_duration_hours: s.min_duration_hours || ((s.min_duration || s.duration_minutes || 240) / 60),
    max_duration_hours: s.max_duration_hours || ((s.max_duration || s.duration_minutes || 240) / 60),
    dm_gender: s.dm_gender || '未指定',
    player_count: Number(s.player_count || s.script_player_roles?.length || 0),
    player_selection_rule: cleanText(s.player_selection_rule, 300) || null,
    player_roles: serializeRoles(s.script_player_roles),
    actor_roles: serializeRoles(s.script_actor_roles),
    boards: serializeBoards(s.script_boards),
    credits: normalizeSharedCredits(s.credits),
    created_by: createdBy,
    review_status: reviewStatus,
    reviewed_at: reviewStatus === 'approved' ? now : null,
    reviewed_by: reviewStatus === 'approved' ? reviewedBy || null : null,
    reject_reason: null,
    updated_at: now,
  }));
  if (!rows.length) return [];
  if (reviewStatus === 'approved') {
    const approved = [];
    for (const row of rows) {
      approved.push(await upsertApprovedSharedTemplate({ ...row, reviewed_by: reviewedBy || null }));
    }
    return approved;
  }
  const { data, error } = await supabase.from('jzg_script_templates')
    .upsert(rows, { onConflict: 'source_script_id,source_tenant_id' })
    .select();
  if (error) throw error;
  return data || [];
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
    if (req.user?.impersonating && req.user?.adminRole === 'store_admin' && req.user?.storeId) {
      return res.json(ok(publicAdminUser({
        id: req.user.adminUserId,
        tenant_id: req.user.tenantId,
        store_id: req.user.storeId,
        email: req.user.email,
        display_name: req.user.displayName || '超管查看店家',
        role: 'store_admin',
        status: 'active',
        impersonating: true,
      })));
    }
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
app.get('/api/auth/verify', async (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json(ok({ valid: false }));
  try {
    const payload = jwt.verify(auth.substring(7), JWT_SECRET) as any;
    if (payload.role === 'admin') {
      const user = await getAdminUserById(payload.adminUserId);
      const valid = Boolean(
        user
        && user.status === 'active'
        && Number(payload.sessionVersion || 0) === Number(user.session_version || 1)
        && (!payload.impersonating || user.role === 'super_admin'),
      );
      return res.json(ok({ valid, payload: valid ? payload : undefined }));
    }
    res.json(ok({ valid: true, payload }));
  } catch {
    res.json(ok({ valid: false }));
  }
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
      pendingFeedback,
      pendingTemplates,
      storesWithoutAdmins,
    ] = await Promise.all([
      supabase.from('jzg_stores').select('*', { count: 'exact', head: true }),
      supabase.from('jzg_stores').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('jzg_admin_users').select('*', { count: 'exact', head: true }),
      supabase.from('scripts').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true }),
      supabase.from('jzg_stores').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('jzg_admin_users').select('id,email,phone,display_name,role,status,tenant_id,store_id,last_login_at,created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('schedules').select('id,tenant_id,script_id,scheduled_date,start_time,status,created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('jzg_feedback_messages').select('id,tenant_id,title,status,priority,created_at', { count: 'exact' }).in('status', ['new', 'processing']).order('created_at', { ascending: false }).limit(5),
      supabase.from('jzg_script_templates').select('id,source_tenant_id,name,review_status,created_at', { count: 'exact' }).eq('review_status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('jzg_stores').select('id,name,city,status,created_at').order('created_at', { ascending: false }).limit(50),
    ]);
    for (const result of [storesCount, activeStoresCount, adminUsersCount, scriptsCount, schedulesCount, recentStores, recentAdminUsers, recentSchedules, pendingFeedback, pendingTemplates, storesWithoutAdmins]) {
      if (result.error && !String(result.error.message || '').includes('jzg_script_templates')) throw result.error;
    }
    const { data: allAdminStores, error: adminStoreErr } = await supabase.from('jzg_admin_users').select('store_id,tenant_id').neq('role', 'super_admin');
    if (adminStoreErr) throw adminStoreErr;
    const adminStoreIds = new Set((allAdminStores || []).map((user: any) => user.store_id || user.tenant_id).filter(Boolean));
    const noAdminStores = (storesWithoutAdmins.data || []).filter((store: any) => !adminStoreIds.has(store.id)).slice(0, 5);
    const todoStoreIds = [
      ...(pendingFeedback.data || []).map((item: any) => item.tenant_id),
      ...(pendingTemplates.data || []).map((item: any) => item.source_tenant_id),
      ...noAdminStores.map((store: any) => store.id),
    ];
    const todoStoreMap = await getStoreMapByIds(todoStoreIds);
    const adminStoreMap = await getStoreMapByIds((recentAdminUsers.data || []).map((user: any) => user.store_id || user.tenant_id));
    const scheduleStoreMap = await getStoreMapByIds((recentSchedules.data || []).map((schedule: any) => schedule.tenant_id));
    const scriptIds = Array.from(new Set((recentSchedules.data || []).map((schedule: any) => cleanText(schedule.script_id, 80)).filter(Boolean)));
    const scriptsById = new Map<string, any>();
    if (scriptIds.length) {
      const { data: scripts, error: scriptsErr } = await supabase.from('scripts').select('id,name').in('id', scriptIds);
      if (scriptsErr) throw scriptsErr;
      (scripts || []).forEach((script: any) => scriptsById.set(script.id, script));
    }
    const todoItems = [
      {
        key: 'feedback',
        title: '待处理站内信',
        count: pendingFeedback.count || 0,
        tone: (pendingFeedback.count || 0) > 0 ? 'high' : 'normal',
        path: `/store/manage/feedback-inbox`,
        items: (pendingFeedback.data || []).map((item: any) => ({ id: item.id, title: item.title, store: todoStoreMap.get(item.tenant_id)?.name || '未知店家', created_at: item.created_at })),
      },
      {
        key: 'templates',
        title: '待审核剧本模板',
        count: pendingTemplates.count || 0,
        tone: (pendingTemplates.count || 0) > 0 ? 'medium' : 'normal',
        path: `/store/manage/templates`,
        items: (pendingTemplates.data || []).map((item: any) => ({ id: item.id, title: item.name, store: todoStoreMap.get(item.source_tenant_id)?.name || '未知店家', created_at: item.created_at })),
      },
      {
        key: 'stores_without_admins',
        title: '未绑定管理员店家',
        count: noAdminStores.length,
        tone: noAdminStores.length > 0 ? 'medium' : 'normal',
        path: `/store/manage/stores`,
        items: noAdminStores.map((store: any) => ({ id: store.id, title: store.name, store: store.city || '未设置城市', created_at: store.created_at })),
      },
    ];
    res.json(ok({
      storeCount: storesCount.count || 0,
      activeStoreCount: activeStoresCount.count || 0,
      adminUserCount: adminUsersCount.count || 0,
      scriptCount: scriptsCount.count || 0,
      scheduleCount: schedulesCount.count || 0,
      todoItems,
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
    const actor = await getAdminUserById(req.user?.adminUserId);
    if (!actor || actor.status !== 'active' || actor.role !== 'super_admin') {
      return res.status(403).json(err(new Error('超级管理员账号状态已变更，请重新登录')));
    }
    const sessionUser = {
      id: actor.id,
      tenant_id: store.id,
      store_id: store.id,
      email: actor.email,
      display_name: `超管查看：${store.name}`,
      role: 'store_admin',
      status: 'active',
      impersonating: true,
      session_version: actor.session_version,
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
      created_by: typeof template.created_by === 'string'
        ? template.created_by.replace(/^灵契共建/, '剧幕录共建')
        : template.created_by,
      store: storeMap.get(template.source_tenant_id) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/platform/script-templates/sync-existing', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data: scripts, error } = await supabase.from('scripts')
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender, role_kind), script_boards(id, name, player_count, notes, is_default, sort_order, script_board_actor_roles(role_name, gender, role_kind, sort_order), script_board_player_roles(role_name, gender, sort_order))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const templates = await publishScriptRowsAsTemplates(scripts || [], '超级管理员同步', 'approved', req.user?.adminUserId || null);
    await logPlatformAction(req, 'script_templates_sync_existing', { type: 'script_template' }, { count: templates.length });
    res.json(ok({ count: templates.length, templates }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/platform/script-templates/:id/review', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const action = cleanText(req.body?.action, 20);
    if (!['approve', 'reject'].includes(action)) return res.status(400).json(err(new Error('审核操作无效')));
    const sourceResult = await supabase.from('jzg_script_templates').select('*').eq('id', req.params.id).single();
    if (sourceResult.error) throw sourceResult.error;
    if (!sourceResult.data) return res.status(404).json(err(new Error('公共剧本投稿不存在')));
    const sourceTemplate = sourceResult.data;
    const canonicalKey = normalizeSharedScriptKey(sourceTemplate.name);
    if (action === 'approve') {
      const duplicateResult = await supabase.from('jzg_script_templates')
        .select('*')
        .eq('canonical_key', canonicalKey)
        .eq('review_status', 'approved')
        .neq('id', req.params.id)
        .maybeSingle();
      if (duplicateResult.error) throw duplicateResult.error;
      if (duplicateResult.data) {
        const merged = await upsertApprovedSharedTemplate({
          ...sourceTemplate,
          id: duplicateResult.data.id,
          reviewed_by: req.user?.adminUserId || null,
        });
        const mergeReason = `已合并到公共剧本 ${merged.id}`;
        const mergedSource = await supabase.from('jzg_script_templates').update({
          canonical_key: canonicalKey,
          review_status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.user?.adminUserId || null,
          reject_reason: mergeReason,
          updated_at: new Date().toISOString(),
        }).eq('id', req.params.id).select().single();
        if (mergedSource.error) throw mergedSource.error;
        await logPlatformAction(req, 'script_template_merged', { type: 'script_template', id: merged.id, label: merged.name }, { mergedFrom: req.params.id });
        return res.json(ok({ ...merged, merged_from: req.params.id }));
      }
    }
    const reviewStatus = action === 'approve' ? 'approved' : 'rejected';
    const rejectReason = action === 'reject' ? cleanText(req.body?.reason, 500) || '超管驳回' : null;
    const { data, error } = await supabase.from('jzg_script_templates')
      .update({
        canonical_key: canonicalKey,
        review_status: reviewStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user?.adminUserId || null,
        reject_reason: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await logPlatformAction(req, `script_template_${reviewStatus}`, { type: 'script_template', id: data.id, label: data.name }, { rejectReason });
    res.json(ok(data));
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

app.get('/api/operation-logs', async (req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_store_operation_logs')
      .select('*')
      .eq('tenant_id', currentTenantId(req))
      .order('created_at', { ascending: false })
      .limit(100);
    if (error && String(error.message || '').includes('jzg_store_operation_logs')) return res.json(ok([]));
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/platform/feedback', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { data, error } = await supabase.from('jzg_feedback_messages')
      .select('*, store:jzg_stores(name, city), admin:jzg_admin_users!jzg_feedback_messages_admin_user_id_fkey(email, display_name), replier:jzg_admin_users!jzg_feedback_messages_replied_by_fkey(email, display_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/platform/feedback/:id', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const status = cleanText(req.body?.status, 20);
    const reply = cleanText(req.body?.reply, 2000);
    if (!['new', 'processing', 'resolved', 'closed'].includes(status)) return res.status(400).json(err(new Error('反馈状态无效')));
    const fields: any = { status, updated_at: new Date().toISOString() };
    if (reply) {
      fields.reply = reply;
      fields.replied_by = req.user?.adminUserId || null;
      fields.replied_at = new Date().toISOString();
    }
    const { data, error } = await supabase.from('jzg_feedback_messages')
      .update(fields)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    await logPlatformAction(req, 'feedback_update', { type: 'feedback', id: data.id, label: data.title }, { status, hasReply: !!reply });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Stores / 多店家后台 =====
app.get('/api/stores', async (req: any, res: any) => {
  try {
    const tenantId = cleanText(req.user?.tenantId, 80);
    if (!isSuperAdminReq(req) && !tenantId) return res.status(403).json(err(new Error('当前账号没有绑定店铺，请重新登录或联系超管')));
    const data = isSuperAdminReq(req)
      ? await db.select().from(jzgStores).orderBy(desc(jzgStores.created_at))
      : await db.select().from(jzgStores).where(eq(jzgStores.id, tenantId)).orderBy(desc(jzgStores.created_at));
    res.json(ok(data || []));
  } catch (e) {
    if (String((e as any)?.message || '').includes('jzg_stores')) return res.json(ok([{ id: TENANT_ID, name: '默认店家', city: '未设置', status: 'active' }]));
    res.status(500).json(err(e));
  }
});

app.post('/api/stores', async (req: any, res: any) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const { name, city, address, contact } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写店家名称')));
    const [data] = await db.insert(jzgStores).values({
      name: String(name).trim(),
      city: city ? String(city).trim() : null,
      address: address ? String(address).trim() : null,
      contact: contact ? String(contact).trim() : null,
      default_deposit_amount: moneyCents(req.body?.defaultDepositAmount ?? 5000),
      early_fee_enabled: true,
      early_fee_start_time: '00:00',
      early_fee_end_time: '12:00',
      early_fee_amount_per_hour: 1000,
      night_fee_enabled: true,
      night_fee_start_time: '00:30',
      night_fee_end_time: '06:00',
      night_fee_amount_per_hour: 1000,
      status: 'active',
    }).returning();
    if (!data) throw new Error('创建店家失败');
    await logPlatformAction(req, 'store_create', { type: 'store', id: data.id, label: data.name }, { city: data.city, address: data.address });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/stores/:id/settings', async (req: any, res: any) => {
  try {
    const tenantId = cleanText(req.user?.tenantId, 80);
    const storeId = cleanText(req.params.id, 80);
    if (!storeId) return res.status(400).json(err(new Error('店家不存在')));
    if (!isSuperAdminReq(req) && !tenantId) return res.status(403).json(err(new Error('当前账号没有绑定店铺，请重新登录或联系超管')));
    if (!isSuperAdminReq(req) && storeId !== tenantId) return res.status(403).json(err(new Error('不能修改其他店家的设置')));
    const fields: any = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 120);
      if (!name) return res.status(400).json(err(new Error('请填写店铺名称')));
      fields.name = name;
    }
    if (req.body.city !== undefined) fields.city = cleanText(req.body.city, 80) || null;
    if (req.body.address !== undefined) fields.address = cleanText(req.body.address, 240) || null;
    if (req.body.contact !== undefined) fields.contact = cleanText(req.body.contact, 160) || null;
    if (req.body.defaultDepositAmount !== undefined) fields.default_deposit_amount = moneyCents(req.body.defaultDepositAmount);
    if (req.body.earlyFeeEnabled !== undefined) fields.early_fee_enabled = Boolean(req.body.earlyFeeEnabled);
    if (req.body.earlyFeeStartTime !== undefined) fields.early_fee_start_time = clockTime(req.body.earlyFeeStartTime, '00:00');
    if (req.body.earlyFeeEndTime !== undefined) fields.early_fee_end_time = clockTime(req.body.earlyFeeEndTime, '12:00');
    if (req.body.earlyFeeAmountPerHour !== undefined) fields.early_fee_amount_per_hour = moneyCents(req.body.earlyFeeAmountPerHour);
    if (req.body.nightFeeEnabled !== undefined) fields.night_fee_enabled = Boolean(req.body.nightFeeEnabled);
    if (req.body.nightFeeStartTime !== undefined) fields.night_fee_start_time = clockTime(req.body.nightFeeStartTime, '00:30');
    if (req.body.nightFeeEndTime !== undefined) fields.night_fee_end_time = clockTime(req.body.nightFeeEndTime, '06:00');
    if (req.body.nightFeeAmountPerHour !== undefined) fields.night_fee_amount_per_hour = moneyCents(req.body.nightFeeAmountPerHour);
    if (!Object.keys(fields).length) return res.status(400).json(err(new Error('没有可保存的设置')));
    const changedFields = Object.keys(fields);
    fields.updated_at = new Date();
    const [data] = await db.update(jzgStores).set(fields).where(eq(jzgStores.id, storeId)).returning();
    if (!data) return res.status(404).json(err(new Error('店家不存在')));
    if (isSuperAdminReq(req)) {
      await logPlatformAction(req, 'store_settings_updated', { type: 'store', id: data.id, label: data.name }, { fields: changedFields });
    } else {
      await logStoreAction(req, 'store_settings_updated', { type: 'store', id: data.id, label: data.name }, { fields: changedFields });
    }
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/feedback', async (req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_feedback_messages')
      .select('*')
      .eq('tenant_id', currentTenantId(req))
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/feedback', async (req: any, res: any) => {
  try {
    const category = feedbackCategoryValue(req.body?.category);
    const title = cleanText(req.body?.title, 160);
    const content = cleanText(req.body?.content, 3000);
    if (!category) return res.status(400).json(err(new Error('反馈类型无效')));
    if (!title) return res.status(400).json(err(new Error('请填写反馈标题')));
    if (!content) return res.status(400).json(err(new Error('请填写反馈内容')));
    const priority = feedbackPriorityFor(category);
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: ['complaint', 'report', 'illegal_content', 'security', 'privacy'].includes(category) ? 'complaint_report_submit' : 'feedback_submit',
      targetType: 'feedback',
      texts: { category, title, content },
      allowContact: category === 'security' || category === 'privacy',
    });
    const { data, error } = await supabase.from('jzg_feedback_messages').insert({
      tenant_id: currentTenantId(req),
      admin_user_id: req.user?.adminUserId || null,
      category,
      title,
      content,
      priority,
      moderation_precheck: moderationPrecheck,
    }).select('*').single();
    if (error) throw error;
    await logStoreAction(req, 'feedback_submitted', { type: 'feedback', id: data.id, label: title }, { category, priority, moderation: moderationPrecheck });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Shared Script Library / 两站共用公共剧本库 =====
app.get('/api/shared/script-library', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_script_templates')
      .select('id,name,canonical_key,duration_minutes,min_duration_hours,max_duration_hours,player_count,player_selection_rule,player_roles,actor_roles,boards,credits,updated_at')
      .eq('review_status', 'approved')
      .order('name', { ascending: true })
      .limit(1000);
    if (error && String(error.message || '').includes('jzg_script_templates')) return res.json(ok([]));
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(ok((data || []).map(publicSharedScriptTemplate)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/shared/script-library/contributions', async (req: any, res: any) => {
  try {
    if (!requireSharedLibraryToken(req, res)) return;
    const template = await upsertApprovedSharedTemplate({
      id: req.body?.scriptId || null,
      name: req.body?.scriptName,
      duration_minutes: req.body?.durationMinutes,
      min_duration_hours: req.body?.minDurationHours,
      max_duration_hours: req.body?.maxDurationHours,
      player_roles: req.body?.playerRoles,
      actor_roles: req.body?.actorRoles,
      credits: req.body?.credits,
      source_script_id: req.body?.legacyScriptId,
      source_system: 'lingqi',
      source_record_id: req.body?.contributionId,
      created_by: cleanText(req.body?.contributorName, 80) ? `剧幕录共建 · ${cleanText(req.body?.contributorName, 80)}` : '剧幕录共建',
    });
    res.json(ok(publicSharedScriptTemplate(template)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/shared/script-library/carpool-sync', async (req: any, res: any) => {
  try {
    if (!requireSharedLibraryToken(req, res)) return;
    const carpoolId = cleanText(req.body?.carpoolId, 120);
    const scriptName = cleanText(req.body?.scriptName, 160);
    const eventDate = cleanText(req.body?.eventDate, 20);
    if (!carpoolId || !scriptName || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json(err(new Error('拼车同步缺少拼车ID、剧本名或有效日期')));
    }
    const reused = await supabase.from('schedules').select('id,script_id').eq('lingqi_carpool_id', carpoolId).maybeSingle();
    if (reused.error) throw reused.error;
    if (reused.data) return res.json(ok({ scheduleId: reused.data.id, storeScriptId: reused.data.script_id, reused: true }));

    const imported = await ensureTenantScriptFromSharedTemplate(req.body?.scriptId, TENANT_ID, scriptName, req.body?.scriptRoles);
    const roomName = cleanText(req.body?.storeName, 100) || `剧幕录拼车-${cleanText(req.body?.city, 40) || '待定城市'}`;
    const roomResult = await supabase.from('rooms').select('id').eq('tenant_id', TENANT_ID).eq('name', roomName).maybeSingle();
    if (roomResult.error) throw roomResult.error;
    let roomId = roomResult.data?.id;
    if (!roomId) {
      const createdRoom = await supabase.from('rooms').insert({
        name: roomName,
        capacity: Math.max(0, Number(req.body?.neededCount || 0)),
        tenant_id: TENANT_ID,
        status: 'active',
      }).select('id').single();
      if (createdRoom.error) throw createdRoom.error;
      roomId = createdRoom.data?.id;
    }

    const startTime = normalizeClockTime(req.body?.startTime, '19:30');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const endMinutes = ((startHour || 0) * 60 + (startMinute || 0) + 240) % 1440;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const createdSchedule = await supabase.from('schedules').insert({
      script_id: imported.script.id,
      room_id: roomId || null,
      scheduled_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
      player_count: Math.max(0, Number(req.body?.neededCount || imported.template?.player_count || 0)),
      customer_name: cleanText(req.body?.customerName, 160) || '剧幕录拼车',
      note: cleanText(req.body?.note, 2000) || null,
      tenant_id: TENANT_ID,
      lingqi_carpool_id: carpoolId,
    }).select('id').single();
    if (createdSchedule.error) throw createdSchedule.error;
    res.json(ok({
      scheduleId: createdSchedule.data?.id || null,
      storeScriptId: imported.script.id,
      sharedScriptId: imported.template?.id || null,
      reused: false,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Script Templates / 公共剧本模版 =====
app.get('/api/script-templates', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_script_templates')
      .select('*')
      .eq('review_status', 'approved')
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
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender, role_kind), script_boards(id, name, player_count, notes, is_default, sort_order, script_board_actor_roles(role_name, gender, role_kind, sort_order), script_board_player_roles(role_name, gender, sort_order))')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();
    if (scriptErr) throw scriptErr;
    if (!s) return res.status(404).json(err(new Error('剧本不存在')));

    const data = await publishScriptRowsAsTemplates([{ ...s, tenant_id: tenantId }], req.user?.displayName || req.user?.email || '剧司辰后台', 'pending');
    res.json(ok(data[0] || null));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/script-templates/:id/import', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: t, error: templateErr } = await supabase.from('jzg_script_templates').select('*').eq('id', req.params.id).eq('review_status', 'approved').single();
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
      player_count: Number(t.player_count || (Array.isArray(t.player_roles) ? t.player_roles.length : 0) || 1),
      player_selection_rule: cleanText(t.player_selection_rule, 300) || null,
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
        role_kind: roleKindValue(r.role_kind),
      })));
    }
    await saveScriptBoards(script!.id, Array.isArray(t.boards) ? t.boards : [], actorRoles, playerRoles, Number(t.player_count || playerRoles.length || 1));
    await supabase.from('jzg_script_templates').update({
      usage_count: (t.usage_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id);
    res.json(ok({ id: script?.id, existing: false }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/uploads/images', async (req: any, res: any) => {
  try {
    const kind = cleanText(req.body?.kind, 40);
    const allowedFolders: Record<string, string> = {
      room: 'rooms',
      actor: 'actors',
      external_npc: 'external-npcs',
      positive_feedback: 'positive-feedback',
    };
    const folder = allowedFolders[kind] || 'misc';
    const url = await saveUploadDataUrl(req.body?.dataUrl, folder);
    res.json(ok({ url }));
  } catch (e) { res.status(400).json(err(e)); }
});

// ===== Rooms =====
app.get('/api/rooms', async (req: any, res: any) => {
  try {
    const data = await db.select().from(rooms).where(eq(rooms.tenant_id, currentTenantId(req))).orderBy(rooms.name);
    res.json(ok(data));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/rooms', async (req: any, res: any) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写房间名称')));
    const tenantId = currentTenantId(req);
    const [data] = await db.insert(rooms).values({
      name,
      capacity: capacity || 0,
      photo_url: cleanText(req.body?.photoUrl || req.body?.photo_url, 500) || null,
      tenant_id: tenantId,
      status: 'active',
    }).returning();
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/rooms/:id', async (req: any, res: any) => {
  try {
    const fields: any = {};
    if (req.body.name !== undefined) fields.name = cleanText(req.body.name, 80);
    if (req.body.capacity !== undefined) fields.capacity = parseInt(req.body.capacity, 10) || 0;
    if (req.body.photoUrl !== undefined || req.body.photo_url !== undefined) fields.photo_url = cleanText(req.body.photoUrl || req.body.photo_url, 500) || null;
    if (req.body.status !== undefined) fields.status = cleanText(req.body.status, 30);
    if (!Object.keys(fields).length) return res.json(ok());
    await db.update(rooms).set(fields).where(and(eq(rooms.id, req.params.id), eq(rooms.tenant_id, currentTenantId(req))));
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/rooms/:id', async (req: any, res: any) => {
  try {
    await db.delete(rooms).where(and(eq(rooms.id, req.params.id), eq(rooms.tenant_id, currentTenantId(req))));
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Actors (卡司/DM) =====
app.get('/api/actors', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('actors').select('*').eq('tenant_id', currentTenantId(req)).order('name');
    const enriched = await Promise.all((data || []).map(async (a: any) => {
      try {
        const lc = await ensureLingqiDmProfileForActor(a);
        return { ...a, lc_profile: lc };
      } catch (profileErr) {
        console.warn('actor Jumulu profile sync skipped', a?.id, err(profileErr).error);
        return { ...a, lc_profile: null, lc_profile_error: '剧幕录档案同步失败' };
      }
    }));
    res.json(ok(enriched));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors', async (req: any, res: any) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写卡司姓名')));
    const { data } = await supabase.from('actors').insert({
      name,
      phone: phone || null,
      gender: actorGender(req.body?.gender),
      photo_url: cleanText(req.body?.photoUrl || req.body?.photo_url, 500) || null,
      tenant_id: currentTenantId(req),
    }).select().single();
    const lcProfile = await ensureLingqiDmProfileForActor(data || { name, phone });
    res.json(ok({ id: data?.id, lc_profile: lcProfile }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/actors/:id', async (req: any, res: any) => {
  try {
    const fields: any = {};
    if (req.body.name !== undefined) fields.name = cleanText(req.body.name, 80);
    if (req.body.phone !== undefined) fields.phone = cleanText(req.body.phone, 40) || null;
    if (req.body.gender !== undefined) fields.gender = actorGender(req.body?.gender);
    if (req.body.photoUrl !== undefined || req.body.photo_url !== undefined) fields.photo_url = cleanText(req.body.photoUrl || req.body.photo_url, 500) || null;
    await supabase.from('actors').update(fields).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
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
    res.json(ok((data || []).map((row: any) => ({
      ...row,
      script_name: relationName(row, 'scripts') || '未命名剧本',
    }))));
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
app.delete('/api/actors/:id/skills/:scriptId/:roleName', async (req: any, res: any) => {
  try {
    const { data: actor } = await supabase.from('actors').select('id').eq('id', req.params.id).eq('tenant_id', currentTenantId(req)).maybeSingle();
    if (!actor) return res.status(404).json(err(new Error('卡司不存在')));
    await supabase.from('actor_skills')
      .delete()
      .eq('actor_id', req.params.id)
      .eq('script_id', req.params.scriptId)
      .eq('role_name', decodeURIComponent(req.params.roleName));
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/actors/:id/learning-tasks', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.params.id, 80);
    const tenantId = currentTenantId(req);
    const { data: actor } = await supabase.from('actors').select('id').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle();
    if (!actor) return res.status(404).json(err(new Error('卡司不存在')));
    const { data, error } = await supabase.from('jzg_actor_learning_tasks')
      .select('*, scripts(name)')
      .eq('actor_id', actorId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error && isMissingRelationError(error, 'jzg_actor_learning_tasks')) return res.json(ok([]));
    if (error) throw error;
    res.json(ok((data || []).map((row: any) => ({
      ...row,
      script_name: relationName(row, 'scripts') || '未命名剧本',
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors/:id/learning-tasks', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.params.id, 80);
    const tenantId = currentTenantId(req);
    const scriptId = cleanText(req.body?.scriptId, 80);
    if (!scriptId) return res.status(400).json(err(new Error('请选择要学的剧本')));
    const [{ data: actor }, { data: script }] = await Promise.all([
      supabase.from('actors').select('id,name').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('scripts').select('id,name').eq('id', scriptId).eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (!actor || !script) return res.status(404).json(err(new Error('卡司或剧本不存在')));
    const { data, error } = await supabase.from('jzg_actor_learning_tasks').insert({
      tenant_id: tenantId,
      actor_id: actorId,
      script_id: scriptId,
      title: cleanText(req.body?.title, 160) || `学习《${script.name}》`,
      due_date: cleanText(req.body?.dueDate, 20) || null,
      note: cleanText(req.body?.note, 1000) || null,
      status: 'assigned',
      created_by: req.user?.displayName || req.user?.email || req.user?.adminUserId || null,
    }).select('*, scripts(name)').single();
    if (error) throw error;
    await logStoreAction(req, 'actor_learning_task_created', { type: 'actor', id: actorId, label: actor.name }, { scriptId, scriptName: script.name });
    res.json(ok({ ...data, script_name: relationName(data, 'scripts') || script.name }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/actors/:id/learning-tasks/:taskId', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.params.id, 80);
    const tenantId = currentTenantId(req);
    const status = cleanText(req.body?.status, 30);
    if (!['assigned', 'in_progress', 'submitted', 'passed', 'failed', 'cancelled'].includes(status)) return res.status(400).json(err(new Error('任务状态无效')));
    const { data: task } = await supabase.from('jzg_actor_learning_tasks')
      .select('*, scripts(name)')
      .eq('id', req.params.taskId)
      .eq('actor_id', actorId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!task) return res.status(404).json(err(new Error('学本任务不存在')));
    const { data, error } = await supabase.from('jzg_actor_learning_tasks')
      .update({ status, note: req.body?.note !== undefined ? cleanText(req.body.note, 1000) : task.note, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .select('*, scripts(name)')
      .single();
    if (error) throw error;
    res.json(ok({ ...data, script_name: relationName(data, 'scripts') || relationName(task, 'scripts') || '未命名剧本' }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/actors/:id/assessments', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.params.id, 80);
    const tenantId = currentTenantId(req);
    const scriptId = cleanText(req.body?.scriptId, 80);
    const taskId = cleanText(req.body?.taskId, 80) || null;
    const result = cleanText(req.body?.result, 20);
    if (!scriptId) return res.status(400).json(err(new Error('请选择考核剧本')));
    if (!['passed', 'failed'].includes(result)) return res.status(400).json(err(new Error('请选择考核结果')));
    const [{ data: actor }, { data: script }] = await Promise.all([
      supabase.from('actors').select('id,name').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('scripts').select('id,name').eq('id', scriptId).eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (!actor || !script) return res.status(404).json(err(new Error('卡司或剧本不存在')));
    const score = Math.max(0, Math.min(100, Number(req.body?.score || (result === 'passed' ? 80 : 50))));
    const { data: assessment, error } = await supabase.from('jzg_actor_assessments').insert({
      tenant_id: tenantId,
      actor_id: actorId,
      script_id: scriptId,
      task_id: taskId,
      assessor_name: cleanText(req.body?.assessorName, 120) || req.user?.displayName || req.user?.email || '店家',
      result,
      score,
      note: cleanText(req.body?.note, 1000) || null,
      assessed_at: new Date().toISOString(),
    }).select('*').single();
    if (error) throw error;
    if (taskId) {
      await supabase.from('jzg_actor_learning_tasks').update({ status: result, updated_at: new Date().toISOString() }).eq('id', taskId).eq('tenant_id', tenantId);
    }
    if (result === 'passed') {
      const { data: actorRole } = await supabase.from('script_actor_roles')
        .select('role_name, role_kind')
        .eq('script_id', scriptId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const roleName = cleanText(req.body?.roleName, 80) || actorRole?.role_name || 'DM';
      const roleType = roleKindValue(req.body?.roleType || actorRole?.role_kind || 'dm');
      const proficiency = Math.max(3, Math.min(5, Math.ceil(score / 20)));
      const { data: existingSkill } = await supabase.from('actor_skills')
        .select('id')
        .eq('actor_id', actorId)
        .eq('script_id', scriptId)
        .eq('role_name', roleName)
        .maybeSingle();
      if (existingSkill?.id) {
        await supabase.from('actor_skills').update({ role_type: roleType, proficiency }).eq('id', existingSkill.id);
      } else {
        await supabase.from('actor_skills').insert({
          actor_id: actorId,
          script_id: scriptId,
          role_name: roleName,
          role_type: roleType,
          proficiency,
        });
      }
    }
    await logStoreAction(req, 'actor_assessment_recorded', { type: 'actor', id: actorId, label: actor.name }, { scriptId, scriptName: script.name, result, score });
    res.json(ok(assessment));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Scripts =====
app.get('/api/scripts', async (req: any, res: any) => {
  try {
    const { data: scripts } = await supabase.from('scripts')
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender, role_kind), script_boards(id, name, player_count, notes, is_default, sort_order, script_board_actor_roles(role_name, gender, role_kind, sort_order), script_board_player_roles(role_name, gender, sort_order))')
      .eq('tenant_id', currentTenantId(req))
      .order('name');
    for (const s of scripts || []) {
      normalizeScriptApiRecord(s);
    }
    res.json(ok(scripts || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('scripts')
      .select('*, script_player_roles(role_name, gender), script_actor_roles(role_name, gender, role_kind), script_boards(id, name, player_count, notes, is_default, sort_order, script_board_actor_roles(role_name, gender, role_kind, sort_order), script_board_player_roles(role_name, gender, sort_order))')
      .eq('id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: skills } = await supabase.from('actor_skills').select('*, actors(name)').eq('script_id', s.id);
    const { data: roles } = await supabase.from('script_roles').select('*').eq('script_id', s.id);
    s.skilled_actors = skills || [];
    s.roles = roles || [];
    s.skilledActors = skills || [];
    normalizeScriptApiRecord(s);
    res.json(ok(s));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/scripts', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name) return res.status(400).json(err(new Error('请填写名称')));
    const playerCount = Math.max(1, Number(req.body.playerCount || (playerRoles || []).length || 1));
    const { data } = await supabase.from('scripts').insert({
      name,
      script_type: scriptTypeValue(req.body.scriptType),
      distribution_type: distributionTypeValue(req.body.distributionType),
      duration_minutes: minDuration,
      min_duration_hours: (minDuration || 0) / 60,
      max_duration_hours: (maxDuration || 0) / 60,
      player_count: playerCount,
      player_selection_rule: cleanText(req.body.playerSelectionRule || req.body.player_selection_rule, 300) || null,
      tenant_id: currentTenantId(req)
    }).select().single();
    for (const r of playerRoles || []) {
      await supabase.from('script_player_roles').insert({ script_id: data!.id, ...parseRole(r) });
    }
    for (const r of actorRoles || []) {
      const parsed = parseRole(r);
      await supabase.from('script_actor_roles').insert({ script_id: data!.id, ...parsed, role_kind: roleKindValue(parsed.role_kind) });
    }
    const savedBoards = await saveScriptBoards(data!.id, req.body.boards, actorRoles || [], playerRoles || [], playerCount);
    await publishScriptRowsAsTemplates([{
      ...data,
      tenant_id: currentTenantId(req),
      player_selection_rule: cleanText(req.body.playerSelectionRule || req.body.player_selection_rule, 300) || null,
      script_player_roles: (playerRoles || []).map(parseRole),
      script_actor_roles: (actorRoles || []).map(parseRole),
      script_boards: savedBoards.map((board: any) => ({ ...board, script_board_actor_roles: board.roles, script_board_player_roles: board.player_roles })),
    }], req.user?.displayName || req.user?.email || '剧司辰后台', 'pending');
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/scripts/:id', async (req: any, res: any) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    const playerCount = Math.max(1, Number(req.body.playerCount || (playerRoles || []).length || 1));
    const tenantId = currentTenantId(req);
    const { data: owned } = await supabase.from('scripts').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!owned) return res.status(404).json(err(new Error('剧本不存在')));
    await supabase.from('scripts').update({
      name,
      script_type: scriptTypeValue(req.body.scriptType),
      distribution_type: distributionTypeValue(req.body.distributionType),
      duration_minutes: minDuration,
      min_duration_hours: (minDuration || 0) / 60,
      max_duration_hours: (maxDuration || 0) / 60,
      player_count: playerCount,
      player_selection_rule: cleanText(req.body.playerSelectionRule || req.body.player_selection_rule, 300) || null,
    }).eq('id', req.params.id).eq('tenant_id', tenantId);
    await supabase.from('script_player_roles').delete().eq('script_id', req.params.id);
    await supabase.from('script_actor_roles').delete().eq('script_id', req.params.id);
    for (const r of playerRoles || []) {
      await supabase.from('script_player_roles').insert({ script_id: req.params.id, ...parseRole(r) });
    }
    for (const r of actorRoles || []) {
      const parsed = parseRole(r);
      await supabase.from('script_actor_roles').insert({ script_id: req.params.id, ...parsed, role_kind: roleKindValue(parsed.role_kind) });
    }
    await saveScriptBoards(req.params.id, req.body.boards, actorRoles || [], playerRoles || [], playerCount);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/scripts/:id', async (req: any, res: any) => {
  try { await supabase.from('scripts').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lingqi/commission-masters', async (req: any, res: any) => {
  try {
    const q = cleanText(req.query.q, 80).toLowerCase();
    const { data: serviceRows, error: serviceErr } = await supabase.from('lc_services')
      .select('creator_id')
      .eq('is_active', true);
    if (serviceErr && isMissingRelationError(serviceErr, 'lc_services')) return res.json(ok([]));
    if (serviceErr) throw serviceErr;
    const profileIds = Array.from(new Set((serviceRows || []).map((row: any) => row.creator_id).filter(Boolean)));
    if (!profileIds.length) return res.json(ok([]));
    const { data: profiles, error } = await supabase.from('lc_profiles')
      .select('id, display_name, avatar, city, available_cities, role_type, identity_roles, verified_dm, is_visible, is_banned')
      .in('id', profileIds)
      .eq('is_visible', true)
      .order('verified_dm', { ascending: false })
      .limit(100);
    if (error) throw error;
    const items = (profiles || [])
      .filter((profile: any) => !profile.is_banned)
      .filter((profile: any) => {
        if (!q) return true;
        const text = [
          profile.display_name,
          profile.city,
          ...(Array.isArray(profile.available_cities) ? profile.available_cities : []),
          profile.role_type,
          ...(Array.isArray(profile.identity_roles) ? profile.identity_roles : []),
        ].join(' ').toLowerCase();
        return text.includes(q);
      })
      .map((profile: any) => ({
        id: profile.id,
        display_name: profile.display_name || '灵契师',
        avatar: profile.avatar || null,
        city: profile.city || null,
        available_cities: Array.isArray(profile.available_cities) ? profile.available_cities : [],
        role_type: profile.role_type || null,
        identity_roles: Array.isArray(profile.identity_roles) ? profile.identity_roles : [],
        verified_dm: Boolean(profile.verified_dm),
      }));
    res.json(ok(items));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Schedules =====
app.get('/api/schedules', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    let q = supabase.from('schedules').select('*, scripts(name), rooms(name, photo_url), script_boards(name)').eq('tenant_id', tenantId).order('scheduled_date');
    if (req.query.startDate) q = q.gte('scheduled_date', req.query.startDate);
    if (req.query.endDate) q = q.lte('scheduled_date', req.query.endDate);
    const { data } = await q;
    const scheduleRows = data || [];
    const sequenceMap = await computeCarSequenceMap(tenantId, scheduleRows);
    const externalData = await loadScheduleExternalData(tenantId, scheduleRows.map((row: any) => row.id));
    // 获取每个排期的上车、定金、结算和评价摘要
    const schedulesWithCheckins = await Promise.all(scheduleRows.map(async (s: any) => {
      const { data: checkins } = await supabase.from('checkins').select('*').eq('schedule_id', s.id);
      const { data: actors } = await supabase.from('schedule_actors').select('*, actors(name, photo_url)').eq('schedule_id', s.id);
      const customerIds = Array.from(new Set((checkins || []).map((c: any) => c.customer_id).filter(Boolean)));
      const { data: customers } = customerIds.length ? await supabase.from('customers').select('id, name, phone, lock_dm_credits').in('id', customerIds).eq('tenant_id', currentTenantId(req)) : { data: [] as any[] };
      const customerMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
      const checkinsWithCustomer = (checkins || []).map((c: any) => ({ ...c, customer: customerMap.get(c.customer_id) || null, lock_dm_credits: customerMap.get(c.customer_id)?.lock_dm_credits || 0 }));
      const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.script_id);
      const selectedActorRoles = await resolveScheduleRoleSelection(s.script_id, s.script_board_id, s.actor_role_selection, s.player_role_selection);
      const { data: evaluations } = await supabase.from('evaluations').select('rating, comment').eq('schedule_id', s.id);
      const { count: positiveFeedbackCount } = await supabase.from('jzg_positive_feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_id', s.id)
        .eq('tenant_id', currentTenantId(req));
      const { count: pendingRequestCount } = await supabase.from('jzg_carpool_join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_id', s.id)
        .eq('status', 'pending');
      const normalizedPlayerRoles = (playerRoles || []).map((r: any) => ({ name: r.role_name, gender: r.gender || '' }));
      const normalizedActorRoles = selectedActorRoles.roles.map((r: any) => ({ name: r.role_name, gender: r.gender || '', role_kind: r.role_kind || 'dm' }));
      return {
        ...s, script_name: s.scripts?.name, room_name: s.rooms?.name, room_photo_url: s.rooms?.photo_url || null,
        computed_car_sequence: sequenceMap.get(s.id) || null,
        script_board_name: s.script_boards?.name || selectedActorRoles.board?.name || null,
        script_board_id: selectedActorRoles.board?.id || s.script_board_id || null,
        actor_role_selection: selectedActorRoles.roles,
        player_role_selection: selectedActorRoles.playerRoles,
        start_time: `${s.scheduled_date}T${s.start_time}`,
        end_time: `${s.scheduled_date}T${s.end_time}`,
        checkins: checkinsWithCustomer,
        actors: (actors || []).map((row: any) => ({
          ...row,
          actor_name: row.actors?.name || row.actor_name,
          actor_photo_url: row.actors?.photo_url || null,
        })),
        player_roles: normalizedPlayerRoles,
        actor_roles: normalizedActorRoles,
        external_npcs: externalData.npcMap.get(s.id) || [],
        lingqi_commissions: externalData.commissionMap.get(s.id) || [],
        pending_request_count: pendingRequestCount || 0,
        positive_feedback_count: positiveFeedbackCount || 0,
        progress_summary: buildScheduleProgress(s, checkinsWithCustomer, normalizedPlayerRoles, evaluations || []),
      };
    }));
    res.json(ok(schedulesWithCheckins));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: s } = await supabase.from('schedules').select('*, scripts(name), rooms(name, photo_url), script_boards(name)').eq('id', req.params.id).eq('tenant_id', tenantId).single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: actors } = await supabase.from('schedule_actors').select('*, actors(name, photo_url)').eq('schedule_id', req.params.id);
    const { data: checkins } = await supabase.from('checkins').select('*').eq('schedule_id', req.params.id);
    const customerIds = Array.from(new Set((checkins || []).map((c: any) => c.customer_id).filter(Boolean)));
    const { data: customers } = customerIds.length ? await supabase.from('customers').select('id, name, phone, lock_dm_credits').in('id', customerIds).eq('tenant_id', tenantId) : { data: [] as any[] };
    const customerMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
    const checkinsWithCustomer = (checkins || []).map((c: any) => ({ ...c, customer: customerMap.get(c.customer_id) || null, lock_dm_credits: customerMap.get(c.customer_id)?.lock_dm_credits || 0 }));
    const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.script_id);
    const selectedActorRoles = await resolveScheduleRoleSelection(s.script_id, s.script_board_id, s.actor_role_selection, s.player_role_selection);
    const { data: evaluations } = await supabase.from('evaluations').select('rating, comment').eq('schedule_id', req.params.id);
    const { count: positiveFeedbackCount } = await supabase.from('jzg_positive_feedbacks')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_id', req.params.id)
      .eq('tenant_id', tenantId);
    const sequenceMap = await computeCarSequenceMap(tenantId, [s]);
    const externalData = await loadScheduleExternalData(tenantId, [s.id]);
    const normalizedPlayerRoles = (playerRoles || []).map((r: any) => ({ name: r.role_name, gender: r.gender || '' }));
    const normalizedActorRoles = selectedActorRoles.roles.map((r: any) => ({ name: r.role_name, gender: r.gender || '', role_kind: r.role_kind || 'dm' }));
    res.json(ok({
      ...s,
      script_name: s.scripts?.name,
      room_name: s.rooms?.name,
      room_photo_url: s.rooms?.photo_url || null,
      computed_car_sequence: sequenceMap.get(s.id) || null,
      actors: (actors || []).map((row: any) => ({
        ...row,
        actor_name: row.actors?.name || row.actor_name,
        actor_photo_url: row.actors?.photo_url || null,
      })),
      script_board_name: s.script_boards?.name || selectedActorRoles.board?.name || null,
      script_board_id: selectedActorRoles.board?.id || s.script_board_id || null,
      actor_role_selection: selectedActorRoles.roles,
      player_role_selection: selectedActorRoles.playerRoles,
      checkins: checkinsWithCustomer,
      player_roles: normalizedPlayerRoles,
      actor_roles: normalizedActorRoles,
      external_npcs: externalData.npcMap.get(s.id) || [],
      lingqi_commissions: externalData.commissionMap.get(s.id) || [],
      positive_feedback_count: positiveFeedbackCount || 0,
      progress_summary: buildScheduleProgress(s, checkinsWithCustomer, normalizedPlayerRoles, evaluations || []),
      start_time: `${s.scheduled_date}T${s.start_time}`,
      end_time: `${s.scheduled_date}T${s.end_time}`,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id/public', async (req: any, res: any) => {
  try {
    const { data: s } = await supabase.from('schedules')
      .select('id,tenant_id,script_id,room_id,scheduled_date,start_time,end_time,status,player_count,store_car_sequence,created_at,scripts(name),rooms(name, photo_url)')
      .eq('id', req.params.id)
      .single();
    if (!s) return res.status(404).json(err(new Error('不存在')));
    const { data: store } = await supabase.from('jzg_stores').select('name, city').eq('id', s.tenant_id).maybeSingle();
    const { data: roles } = await supabase.from('script_roles').select('role_name, gender, start_offset, end_offset').eq('script_id', s.script_id).order('start_offset');
    const { data: playerRoles } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.script_id);
    const { data: checkins } = await supabase.from('checkins').select('role').eq('schedule_id', req.params.id).not('role', 'is', null);
    const { data: actors } = await supabase.from('schedule_actors').select('role_name, actors(name, photo_url)').eq('schedule_id', req.params.id);
    const { count: pendingRequestCount } = await supabase.from('jzg_carpool_join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_id', req.params.id)
      .eq('status', 'pending');
    const sequenceMap = await computeCarSequenceMap(s.tenant_id, [s]);
    const externalData = await loadScheduleExternalData(s.tenant_id, [s.id]);
    const ratingSummary = await buildScheduleRatingSummary(s.tenant_id, s);
    const publicNpcs = (externalData.npcMap.get(s.id) || []).map((row: any) => ({
      role_name: row.role_name,
      provided_by: row.provided_by || null,
      note: row.note || null,
      photo_url: row.photo_url || null,
      count_as_player: !!row.count_as_player,
    }));
    const commissions = (externalData.commissionMap.get(s.id) || [])
      .filter((row: any) => ['accepted', 'confirmed'].includes(cleanText(row.status, 30)))
      .map((row: any) => ({
        display_name: row.display_name,
        avatar_url: row.avatar_url || null,
        role_name: row.role_name || null,
        service_type: row.service_type || 'experience_support',
        status: row.status,
      }));
    res.json(ok({
      id: s.id,
      script_id: s.script_id,
      room_id: s.room_id,
      scheduled_date: s.scheduled_date,
      status: publicScheduleStatus(s.status),
      player_count: s.player_count,
      store_car_sequence: s.store_car_sequence || null,
      computed_car_sequence: sequenceMap.get(s.id) || null,
      note: null,
      script_name: s.scripts?.name,
      room_name: s.rooms?.name,
      room_photo_url: s.rooms?.photo_url || null,
      store_name: store?.name,
      store_city: store?.city,
      roles: roles || [],
      player_roles: (playerRoles || []).map((r: any) => ({ name: r.role_name, gender: r.gender || '' })),
      actors: (actors || []).map((row: any) => ({
        role_name: row.role_name,
        actor_name: row.actors?.name || '卡司',
        actor_photo_url: row.actors?.photo_url || null,
      })),
      external_npcs: publicNpcs,
      lingqi_commissions: commissions,
      rating_summary: ratingSummary,
      taken_roles: (checkins || []).map((c: any) => c.role),
      checkins: (checkins || []).map((c: any) => ({ role: c.role, gender: '' })),
      pending_request_count: pendingRequestCount || 0,
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
    const { data: script } = await supabase.from('scripts').select('id,name,player_count').eq('id', d.scriptId).eq('tenant_id', tenantId).maybeSingle();
    if (!script) return res.status(404).json(err(new Error('剧本不存在')));
    const roleSelection = await resolveScheduleRoleSelection(
      d.scriptId,
      cleanText(d.scriptBoardId || d.script_board_id, 80) || null,
      Array.isArray(d.actorRoleSelection) ? d.actorRoleSelection : d.actor_role_selection,
      Array.isArray(d.playerRoleSelection) ? d.playerRoleSelection : d.player_role_selection,
    );
    if (d.roomId) {
      const { data: room } = await supabase.from('rooms').select('id').eq('id', d.roomId).eq('tenant_id', tenantId).maybeSingle();
      if (!room) return res.status(404).json(err(new Error('房间不存在')));
    }
    const actorAssignments = Array.isArray(d.actors)
      ? d.actors.filter((a: any) => cleanText(a?.actorId, 80) && cleanText(a?.roleName, 120))
      : [];
    if (actorAssignments.length) {
      const actorsValid = await validateTenantActors(req, res, actorAssignments.map((a: any) => a.actorId));
      if (!actorsValid) return;
      const validRoleKeys = new Set(roleSelection.roles.map(role => roleNameKey(role.role_name)));
      for (const actorRow of actorAssignments) {
        const roleName = cleanText(actorRow?.roleName, 120);
        if (roleName && validRoleKeys.size && !validRoleKeys.has(roleNameKey(roleName))) {
          return res.status(400).json(err(new Error(`卡司角色“${roleName}”不在本场选择的演绎角色里`)));
        }
      }
    }
    const { data, error: scheduleInsertErr } = await supabase.from('schedules').insert({
      script_id: d.scriptId, room_id: d.roomId || null,
      script_board_id: roleSelection.board?.id || null,
      actor_role_selection: roleSelection.roles,
      player_role_selection: roleSelection.playerRoles,
      scheduled_date: dateStr, start_time: startTimeStr, end_time: endTimeStr,
      store_car_sequence: Number(d.storeCarSequence || d.store_car_sequence || 0) || null,
      status: d.status || 'pending', player_count: Number(d.playerCount || script.player_count || 0),
      customer_name: d.customerName || null,
      customer_phone: d.customerPhone || null,
      note: d.note || null,
      tenant_id: tenantId
    }).select().single();
    throwDbError(scheduleInsertErr);
    if (!data?.id) throw new Error('排期保存失败，数据库没有返回新车次');
    if (actorAssignments.length) {
      const { error: scheduleActorErr } = await supabase.from('schedule_actors').insert(actorAssignments.map((a: any) => ({ schedule_id: data.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
      throwDbError(scheduleActorErr);
    }
    await saveScheduleExternalData(req, data.id, tenantId, d);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(data.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    await logStoreAction(req, 'schedule_created', { type: 'schedule', id: data?.id, label: script.name }, { date: dateStr, startTime: startTimeStr, endTime: endTimeStr });
    res.json(ok({ ...data, lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const d = req.body;
    const tenantId = currentTenantId(req);
    const { data: owned } = await supabase.from('schedules').select('id, status, script_id, script_board_id, actor_role_selection, player_role_selection').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!owned) return res.status(404).json(err(new Error('排期不存在')));
    if (['completed', 'cancelled', 'bombed', 'issue'].includes(owned.status)) return res.status(400).json(err(new Error('历史记录已归档，不能修改车次核心信息')));
    const fields: any = {};
    if (d.scriptId !== undefined) {
      const { data: script } = await supabase.from('scripts').select('id').eq('id', d.scriptId).eq('tenant_id', tenantId).maybeSingle();
      if (!script) return res.status(404).json(err(new Error('剧本不存在')));
      fields.script_id = d.scriptId;
    }
    const nextScriptId = fields.script_id || owned.script_id;
    const roleSelection = await resolveScheduleRoleSelection(
      nextScriptId,
      d.scriptBoardId !== undefined || d.script_board_id !== undefined
        ? cleanText(d.scriptBoardId || d.script_board_id, 80) || null
        : owned.script_board_id,
      d.actorRoleSelection !== undefined || d.actor_role_selection !== undefined
        ? (Array.isArray(d.actorRoleSelection) ? d.actorRoleSelection : d.actor_role_selection)
        : owned.actor_role_selection,
      d.playerRoleSelection !== undefined || d.player_role_selection !== undefined
        ? (Array.isArray(d.playerRoleSelection) ? d.playerRoleSelection : d.player_role_selection)
        : owned.player_role_selection,
    );
    if (d.scriptId !== undefined || d.scriptBoardId !== undefined || d.script_board_id !== undefined || d.actorRoleSelection !== undefined || d.actor_role_selection !== undefined || d.playerRoleSelection !== undefined || d.player_role_selection !== undefined) {
      fields.script_board_id = roleSelection.board?.id || null;
      fields.actor_role_selection = roleSelection.roles;
      fields.player_role_selection = roleSelection.playerRoles;
    }
    if (d.roomId !== undefined) {
      if (d.roomId) {
        const { data: room } = await supabase.from('rooms').select('id').eq('id', d.roomId).eq('tenant_id', tenantId).maybeSingle();
        if (!room) return res.status(404).json(err(new Error('房间不存在')));
      }
      fields.room_id = d.roomId;
    }
    if (d.startTime) {
      fields.scheduled_date = d.date || d.startTime.split('T')[0];
      fields.start_time = d.timeStart || d.startTime.split('T')[1]?.substring(0, 5);
    }
    if (d.endTime) {
      fields.end_time = d.timeEnd || d.endTime.split('T')[1]?.substring(0, 5);
    }
    if (d.status) {
      fields.status = d.status;
      if (d.status === 'ongoing') fields.actual_started_at = new Date().toISOString();
    }
    if (d.customerName !== undefined) fields.customer_name = d.customerName;
    if (d.customerPhone !== undefined) fields.customer_phone = d.customerPhone;
    if (d.playerCount !== undefined) fields.player_count = d.playerCount;
    if (d.note !== undefined) fields.note = d.note;
    if (d.storeCarSequence !== undefined || d.store_car_sequence !== undefined) fields.store_car_sequence = Number(d.storeCarSequence || d.store_car_sequence || 0) || null;
    const { error: scheduleUpdateErr } = await supabase.from('schedules').update(fields).eq('id', req.params.id).eq('tenant_id', tenantId);
    throwDbError(scheduleUpdateErr);
    if (Array.isArray(d.actors)) {
      const actorAssignments = d.actors.filter((a: any) => cleanText(a?.actorId, 80) && cleanText(a?.roleName, 120));
      const actorsValid = await validateTenantActors(req, res, actorAssignments.map((a: any) => a.actorId));
      if (!actorsValid) return;
      const validRoleKeys = new Set(roleSelection.roles.map(role => roleNameKey(role.role_name)));
      for (const actorRow of actorAssignments) {
        const roleName = cleanText(actorRow?.roleName, 120);
        if (roleName && validRoleKeys.size && !validRoleKeys.has(roleNameKey(roleName))) {
          return res.status(400).json(err(new Error(`卡司角色“${roleName}”不在本场选择的演绎角色里`)));
        }
      }
      const { error: deleteActorErr } = await supabase.from('schedule_actors').delete().eq('schedule_id', req.params.id);
      throwDbError(deleteActorErr);
      if (actorAssignments.length) {
        const { error: insertActorErr } = await supabase.from('schedule_actors').insert(actorAssignments.map((a: any) => ({ schedule_id: req.params.id, actor_id: a.actorId, role_name: a.roleName, start_time: a.startTime, end_time: a.endTime })));
        throwDbError(insertActorErr);
      }
    }
    await saveScheduleExternalData(req, req.params.id, tenantId, d);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    await logStoreAction(req, 'schedule_updated', { type: 'schedule', id: req.params.id }, { fields: Object.keys(fields), lingqiSync });
    res.json(ok({ lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/schedules/:id', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: owned } = await supabase.from('schedules').select('id, status').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!owned) return res.status(404).json(err(new Error('排期不存在')));
    if (['completed', 'cancelled', 'bombed', 'issue'].includes(owned.status)) return res.status(400).json(err(new Error('历史记录已归档，不能删除')));
    await supabase.from('schedules').delete().eq('id', req.params.id).eq('tenant_id', tenantId);
    await logStoreAction(req, 'schedule_deleted', { type: 'schedule', id: req.params.id });
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/confirm', async (req: any, res: any) => {
  try {
    if (!req.body.roomId) return res.status(400).json(err(new Error('请选择房间')));
    const tenantId = currentTenantId(req);
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const { data: room } = await supabase.from('rooms').select('id').eq('id', req.body.roomId).eq('tenant_id', tenantId).maybeSingle();
    if (!room) return res.status(404).json(err(new Error('房间不存在')));
    await supabase.from('schedules').update({ room_id: req.body.roomId, status: 'scheduled' }).eq('id', req.params.id).eq('tenant_id', tenantId);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    await logStoreAction(req, 'schedule_room_confirmed', { type: 'schedule', id: req.params.id }, { roomId: req.body.roomId, lingqiSync });
    res.json(ok({ lingqi_sync: lingqiSync }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/cancel', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const nextStatus = req.body.status || 'cancelled';
    if (nextStatus === 'cancelled') {
      const { data: checkins } = await supabase.from('checkins').select('id, deposit_status').eq('schedule_id', req.params.id);
      const unrefunded = (checkins || []).filter((item: any) => item.deposit_status === 'paid');
      if (unrefunded.length > 0) return res.status(400).json(err(new Error('还有已收定金未确认退款，不能流车')));
    }
    await supabase.from('schedules').update({ status: nextStatus }).eq('id', req.params.id).eq('tenant_id', tenantId);
    let lingqiSync: any = { ok: true, skipped: true, reason: 'not_carpool' };
    try {
      lingqiSync = await syncScheduleToLingqiCarpool(req.params.id, tenantId);
    } catch (syncErr) {
      lingqiSync = { ok: false, skipped: false, reason: err(syncErr).error };
    }
    await logStoreAction(req, 'schedule_status_changed', { type: 'schedule', id: req.params.id }, { status: nextStatus, lingqiSync });
    res.json(ok({ lingqi_sync: lingqiSync }));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/complete', async (req: any, res: any) => {
  try {
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const actualLeftAt = cleanText(req.body?.actualLeftAt, 40);
    await supabase.from('schedules').update({
      status: 'settling',
      actual_ended_at: new Date().toISOString(),
      actual_left_at: actualLeftAt || null,
      props_checked: !!req.body?.propsChecked,
      costumes_checked: !!req.body?.costumesChecked,
      script_cards_checked: !!req.body?.scriptCardsChecked,
      review_requested: !!req.body?.reviewRequested,
      debrief_done: !!req.body?.debriefDone,
      settlement_status: 'pending',
    }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    await logStoreAction(req, 'schedule_wrapup_confirmed', { type: 'schedule', id: req.params.id }, {
      propsChecked: !!req.body?.propsChecked,
      costumesChecked: !!req.body?.costumesChecked,
      scriptCardsChecked: !!req.body?.scriptCardsChecked,
      reviewRequested: !!req.body?.reviewRequested,
      debriefDone: !!req.body?.debriefDone,
      actualLeftAt: actualLeftAt || null,
    });
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/schedules/:id/settle', async (req: any, res: any) => {
  try {
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    await supabase.from('schedules').update({
      status: 'completed',
      settlement_status: 'settled',
      settlement_completed_at: new Date().toISOString(),
      settlement_note: cleanText(req.body?.note, 500) || null,
    }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    await logStoreAction(req, 'schedule_settled', { type: 'schedule', id: req.params.id });
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/dm-start', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const actualStartedAt = req.body?.actualStartTime ? new Date(req.body.actualStartTime) : new Date();
    if (Number.isNaN(actualStartedAt.getTime())) return res.status(400).json(err(new Error('开本时间无效')));
    const actorRows = Array.isArray(req.body?.actors) ? req.body.actors : [];
    const { data: schedule } = await supabase.from('schedules')
      .select('id, tenant_id, script_id, script_board_id, actor_role_selection, player_role_selection, status, scripts(duration_minutes)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    if (!['locked', 'confirmed', 'ongoing'].includes(schedule.status)) return res.status(400).json(err(new Error('当前状态不能确认开本')));
    const selectedActorRoles = await resolveScheduleRoleSelection(schedule.script_id, schedule.script_board_id, schedule.actor_role_selection, schedule.player_role_selection);
    const validRoleNames = new Set((selectedActorRoles.roles || []).map((role: any) => cleanText(role.role_name, 120)).filter(Boolean));
    if (validRoleNames.size > 0) {
      for (const roleName of validRoleNames) {
        if (!actorRows.some((row: any) => cleanText(row?.roleName, 120) === roleName && cleanText(row?.actorId, 80))) {
          return res.status(400).json(err(new Error(`请确认卡司角色“${roleName}”由谁扮演`)));
        }
      }
    }
    const assignments = [];
    for (const row of actorRows) {
      const actorId = cleanText(row?.actorId, 80);
      const roleName = cleanText(row?.roleName, 120);
      if (!actorId || !roleName) continue;
      if (validRoleNames.size > 0 && !validRoleNames.has(roleName)) return res.status(400).json(err(new Error(`卡司角色“${roleName}”不属于当前剧本`)));
      const { data: actor } = await supabase.from('actors').select('id').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle();
      if (!actor) return res.status(404).json(err(new Error(`卡司不存在：${roleName}`)));
      assignments.push({ actor_id: actorId, role_name: roleName });
    }
    const durationMinutes = Number((Array.isArray(schedule.scripts) ? schedule.scripts[0]?.duration_minutes : schedule.scripts?.duration_minutes) || 240);
    const actorEndAt = new Date(actualStartedAt.getTime() + Math.max(1, durationMinutes) * 60000);
    await supabase.from('schedule_actors').delete().eq('schedule_id', schedule.id);
    if (assignments.length) {
      await supabase.from('schedule_actors').insert(assignments.map(row => ({
        schedule_id: schedule.id,
        actor_id: row.actor_id,
        role_name: row.role_name,
        start_time: actualStartedAt.toISOString(),
        end_time: actorEndAt.toISOString(),
      })));
    }
    const { data, error } = await supabase.from('schedules').update({
      status: 'ongoing',
      actual_started_at: actualStartedAt.toISOString(),
    }).eq('id', schedule.id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    await logStoreAction(req, 'schedule_started', { type: 'schedule', id: schedule.id }, { actualStartedAt: actualStartedAt.toISOString(), actors: assignments.map(row => row.role_name) });
    res.json(ok(data));
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
  try {
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const { data } = await supabase.from('checkins').select('*').eq('schedule_id', req.params.id).order('checked_at', { ascending: false });
    res.json(ok(data));
  }
  catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/schedules/:id/checkins/:checkinId/finance', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: schedule } = await supabase.from('schedules').select('id, tenant_id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    const fields: any = {};
    if (req.body.depositStatus !== undefined) fields.deposit_status = cleanText(req.body.depositStatus, 30) || 'unpaid';
    if (req.body.depositAmount !== undefined) fields.deposit_amount = moneyCents(req.body.depositAmount);
    if (req.body.depositPaymentMethod !== undefined) fields.deposit_payment_method = cleanText(req.body.depositPaymentMethod, 40) || null;
    if (req.body.depositNote !== undefined) fields.deposit_note = cleanText(req.body.depositNote, 300) || null;
    if (req.body.depositPayerName !== undefined) fields.deposit_payer_name = cleanText(req.body.depositPayerName, 80) || null;
    if (req.body.depositSettlementMode !== undefined) fields.deposit_settlement_mode = depositSettlementMode(req.body.depositSettlementMode);
    if (req.body.customerId !== undefined) {
      const customerId = cleanText(req.body.customerId, 80) || null;
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('id').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle();
        if (!customer) return res.status(404).json(err(new Error('客户不存在')));
      }
      fields.customer_id = customerId;
    }
    if (req.body.finalAmount !== undefined) fields.final_amount = moneyCents(req.body.finalAmount);
    if (req.body.finalPaymentMethod !== undefined) fields.final_payment_method = cleanText(req.body.finalPaymentMethod, 40) || null;
    if (req.body.settlementStatus !== undefined) fields.settlement_status = cleanText(req.body.settlementStatus, 30) || 'unsettled';
    if (req.body.settlementNote !== undefined) fields.settlement_note = cleanText(req.body.settlementNote, 300) || null;
    if (fields.deposit_status === 'paid') fields.deposit_paid_at = new Date().toISOString();
    if (fields.deposit_status === 'refunded') fields.deposit_note = fields.deposit_note || '全款结算后退定金';
    if (fields.settlement_status === 'settled') fields.final_paid_at = new Date().toISOString();
    const { data, error } = await supabase.from('checkins')
      .update(fields)
      .eq('id', req.params.checkinId)
      .eq('schedule_id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await logStoreAction(req, 'checkin_finance_updated', { type: 'checkin', id: req.params.checkinId, label: data?.guest_name }, { scheduleId: req.params.id, fields: Object.keys(fields) });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/schedules/:id/checkin', async (req: any, res: any) => {
  try {
    const role = cleanText(req.body?.role, 80);
    if (!req.user?.playerId) return res.status(401).json(err(new Error('请先登录玩家账号')));
    const { data: sched } = await supabase.from('schedules')
      .select('id,tenant_id,script_id,status,player_count')
      .eq('id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .maybeSingle();
    if (!sched) return res.status(404).json(err(new Error('排期不存在')));
    if (!canPublicJoinSchedule(sched.status)) return res.status(400).json(err(new Error('当前排期不允许报名')));
    const { data: player, error: playerErr } = await supabase.from('players')
      .select('id,tenant_id,display_name,phone_hash,wechat_avatar')
      .eq('id', req.user.playerId)
      .eq('tenant_id', sched.tenant_id)
      .maybeSingle();
    if (playerErr) throw playerErr;
    if (!player) return res.status(401).json(err(new Error('玩家账号不存在，请重新登录')));
    const { data: existingCheckin } = await supabase.from('checkins')
      .select('*')
      .eq('schedule_id', req.params.id)
      .eq('player_id', player.id)
      .maybeSingle();
    if (existingCheckin) return res.json(ok({ ...existingCheckin, existing: true, full: false }));
    const { data: allRoles } = await supabase.from('script_player_roles').select('role_name').eq('script_id', sched.script_id);
    const validRoles = (allRoles || []).map((item: any) => publicRoleKey(item.role_name)).filter(Boolean);
    if (role && validRoles.length && !validRoles.includes(publicRoleKey(role))) {
      return res.status(400).json(err(new Error('角色不存在')));
    }
    if (role) {
      const { data: taken } = await supabase.from('checkins')
        .select('id')
        .eq('schedule_id', req.params.id)
        .eq('role', role)
        .maybeSingle();
      if (taken) return res.status(409).json(err(new Error('这个角色已经被选择')));
    }
    const { data, error: insertErr } = await supabase.from('checkins').insert({
      schedule_id: req.params.id,
      player_id: player.id,
      guest_name: cleanText(player.display_name, 80) || '玩家',
      guest_phone: player.phone_hash || null,
      role: role || null,
      guest_avatar: cleanText(player.wechat_avatar, 500) || null,
    }).select().single();
    if (insertErr) {
      if (String(insertErr.code || '') === '23505') return res.status(409).json(err(new Error('这个角色已经被选择，或你已经上车')));
      throw insertErr;
    }
    let full = false;
    if (sched && data) {
      const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('schedule_id', req.params.id);
      const targetCount = Number(sched.player_count || validRoles.length || 0);
      if (targetCount && count !== null && count >= targetCount) {
        await supabase.from('schedules')
          .update({ status: 'scheduled' })
          .eq('id', req.params.id)
          .eq('tenant_id', sched.tenant_id)
          .in('status', ['pending', 'confirmed']);
        full = true;
      }
    }
    res.json(ok({ ...data, existing: false, full }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/schedules/:id/lock', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const lockReason = cleanText(req.body?.lockReason, 40) || 'deposit_guaranteed';
    const { data: schedule } = await supabase.from('schedules')
      .select('id, tenant_id, status')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    if (['cancelled', 'bombed', 'completed'].includes(schedule.status)) return res.status(400).json(err(new Error('当前状态不能锁车')));
    const { data: checkins } = await supabase.from('checkins').select('id, deposit_status').eq('schedule_id', schedule.id);
    if (!checkins?.length) return res.status(400).json(err(new Error('这车还没有玩家，不能锁车')));
    const depositRequired = checkins.filter((item: any) => !['waived', 'refunded'].includes(item.deposit_status || '')).length;
    const depositReady = checkins.filter((item: any) => ['paid', 'waived'].includes(item.deposit_status || '')).length;
    if (depositReady < Math.max(1, depositRequired)) return res.status(400).json(err(new Error('定金未交齐，不能锁车')));
    const { data, error } = await supabase.from('schedules')
      .update({
        status: 'locked',
        lock_reason: lockReason,
        locked_at: new Date().toISOString(),
        locked_by: req.user?.adminUserId || null,
      })
      .eq('id', schedule.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    await logStoreAction(req, 'schedule_locked', { type: 'schedule', id: schedule.id }, { lockReason });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/schedules/:id/dm-assignment', async (req: any, res: any) => {
  try {
    if (!useTencentPg) return res.status(503).json(err(new Error('锁 DM 权益当前只允许在正式 PostgreSQL 主库执行')));
    const tenantId = currentTenantId(req);
    const mode = cleanText(req.body?.mode, 30);
    const actorId = cleanText(req.body?.actorId, 80);
    const customerId = cleanText(req.body?.customerId, 80);
    const roleName = cleanText(req.body?.roleName, 120);
    const { data: schedule } = await supabase.from('schedules')
      .select('id, tenant_id, status, script_id, script_board_id, actor_role_selection, player_role_selection, dm_lock_customer_id, requested_dm_actor_id, requested_dm_role_name, dm_lock_status, dm_lock_credit_transaction_id')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    if (['cancelled', 'bombed', 'completed'].includes(schedule.status)) return res.status(400).json(err(new Error('当前状态不能指定 DM')));

    if (mode === 'not_needed' || mode === 'clear') {
      const data = await updateDmAssignmentOnPostgres({
        tenantId,
        scheduleId: schedule.id,
        mode,
      });
      await logStoreAction(req, mode === 'not_needed' ? 'dm_assignment_not_needed' : 'dm_assignment_cleared', { type: 'schedule', id: schedule.id });
      return res.json(ok(data));
    }

    if (!actorId) return res.status(400).json(err(new Error('请选择要指定的卡司/DM')));
    if (!customerId) return res.status(400).json(err(new Error('请选择扣除锁卡司次数的玩家')));
    if (!roleName) return res.status(400).json(err(new Error('请选择要指定的卡司角色')));

    const { data: actor } = await supabase.from('actors').select('id').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle();
    if (!actor) return res.status(404).json(err(new Error('卡司/DM 不存在')));
    const selectedActorRoles = await resolveScheduleRoleSelection(schedule.script_id, schedule.script_board_id, schedule.actor_role_selection, schedule.player_role_selection);
    if (!selectedActorRoles.roles.some((role: any) => roleNameKey(role.role_name) === roleNameKey(roleName))) {
      return res.status(400).json(err(new Error('这个卡司角色不属于本场选择的演绎角色')));
    }
    const { data: checkin } = await supabase.from('checkins')
      .select('id, customer_id, guest_name')
      .eq('schedule_id', schedule.id)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!checkin) return res.status(400).json(err(new Error('请选择本车已上车玩家扣除锁卡司次数')));
    const data = await updateDmAssignmentOnPostgres({
      tenantId,
      scheduleId: schedule.id,
      mode: 'assign',
      customerId,
      actorId,
      roleName,
      checkinId: checkin.id,
    });
    await logStoreAction(req, 'dm_assignment_confirmed', { type: 'schedule', id: schedule.id }, { roleName, actorId, customerId });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/schedules/:id/dm-lock', async (req: any, res: any) => {
  try {
    if (!useTencentPg) return res.status(503).json(err(new Error('锁 DM 权益当前只允许在正式 PostgreSQL 主库执行')));
    const tenantId = currentTenantId(req);
    const customerId = cleanText(req.body?.customerId, 80);
    const actorId = cleanText(req.body?.actorId, 80);
    if (!customerId) return res.status(400).json(err(new Error('请选择使用锁 DM 权益的客户/车头')));
    if (!actorId) return res.status(400).json(err(new Error('请选择要指定的 DM')));
    const { data: schedule } = await supabase.from('schedules')
      .select('id, tenant_id, status, dm_lock_status')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    if (!['locked', 'confirmed', 'ongoing', 'settling'].includes(schedule.status)) return res.status(400).json(err(new Error('锁车后才能指定 DM')));
    const { data: actor } = await supabase.from('actors').select('id').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle();
    if (!actor) return res.status(404).json(err(new Error('DM 不存在')));
    const data = await updateDmAssignmentOnPostgres({
      tenantId,
      scheduleId: schedule.id,
      mode: 'request',
      customerId,
      actorId,
    });
    await logStoreAction(req, 'dm_lock_used', { type: 'schedule', id: schedule.id }, { actorId, customerId });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/schedules/:id/staff-checkin', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { name, phone, role, avatar } = req.body;
    const guestName = cleanText(name, 80);
    const roleName = cleanText(role, 80);
    if (!guestName) return res.status(400).json(err(new Error('请填写玩家称呼')));
    if (!roleName) return res.status(400).json(err(new Error('请选择角色')));

    const { data: schedule, error: scheduleErr } = await supabase.from('schedules')
      .select('id, tenant_id, script_id, player_count')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (scheduleErr) throw scheduleErr;
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));

    const { data: roleExists } = await supabase.from('script_player_roles')
      .select('id')
      .eq('script_id', schedule.script_id)
      .eq('role_name', roleName)
      .maybeSingle();
    if (!roleExists) return res.status(400).json(err(new Error('这个角色不在当前排期可选范围内')));

    const { data: taken } = await supabase.from('checkins')
      .select('id')
      .eq('schedule_id', schedule.id)
      .eq('role', roleName)
      .maybeSingle();
    if (taken) return res.status(409).json(err(new Error('这个角色已经有人上车了')));

    const { data, error } = await supabase.from('checkins').insert({
      schedule_id: schedule.id,
      guest_name: guestName,
      guest_phone: phone ? hashPhone(String(phone)) : null,
      role: roleName,
      guest_avatar: avatar || null,
    }).select().single();
    if (error) throw error;

    const { data: allRoles } = await supabase.from('script_player_roles').select('id').eq('script_id', schedule.script_id);
    const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('schedule_id', schedule.id);
    let full = false;
    const targetCount = Number(schedule.player_count || allRoles?.length || 0);
    if (targetCount && count !== null && count >= targetCount) {
      await supabase.from('schedules').update({ status: 'scheduled' }).eq('id', schedule.id).eq('tenant_id', tenantId);
      full = true;
    }
    res.json(ok({ ...data, full }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/schedules/:id/join-requests', async (req: any, res: any) => {
  try {
    const { data: schedule, error: scheduleErr } = await supabase.from('schedules')
      .select('id')
      .eq('id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .maybeSingle();
    if (scheduleErr) throw scheduleErr;
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    const { data, error } = await supabase.from('jzg_carpool_join_requests')
      .select('*')
      .eq('schedule_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error && String(error.message || '').includes('jzg_carpool_join_requests')) return res.json(ok([]));
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/schedules/:id/join-requests/:requestId', async (req: any, res: any) => {
  try {
    const action = cleanText(req.body?.action, 20);
    const reviewNote = cleanText(req.body?.reviewNote, 300) || null;
    if (!['confirm', 'reject'].includes(action)) return res.status(400).json(err(new Error('操作无效')));
    const { data: schedule, error: scheduleErr } = await supabase.from('schedules')
      .select('id, tenant_id, script_id')
      .eq('id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .maybeSingle();
    if (scheduleErr) throw scheduleErr;
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    const { data: request, error: requestErr } = await supabase.from('jzg_carpool_join_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('schedule_id', req.params.id)
      .maybeSingle();
    if (requestErr) throw requestErr;
    if (!request) return res.status(404).json(err(new Error('申请不存在')));
    if (request.status !== 'pending') return res.status(400).json(err(new Error('该申请已处理')));

    if (action === 'reject') {
      const { data, error } = await supabase.from('jzg_carpool_join_requests')
        .update({
          status: 'rejected',
          reviewed_by: req.user?.adminUserId || null,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select()
        .single();
      if (error) throw error;
      return res.json(ok(data));
    }

    const { data: checkin, error: checkinErr } = await supabase.from('checkins').insert({
      schedule_id: req.params.id,
      player_id: request.player_id || null,
      guest_name: request.display_name,
      guest_phone: request.phone_hash || null,
      role: request.role_name || null,
    }).select().single();
    if (checkinErr) {
      if (String(checkinErr.code || '') === '23505') return res.status(409).json(err(new Error('这个角色已经有人上车，或该玩家已经加入本车')));
      throw checkinErr;
    }

    const { data, error } = await supabase.from('jzg_carpool_join_requests')
      .update({
        status: 'confirmed',
        checkin_id: checkin.id,
        reviewed_by: req.user?.adminUserId || null,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .select()
      .single();
    if (error) throw error;

    const { data: allRoles } = await supabase.from('script_player_roles').select('id').eq('script_id', schedule.script_id);
    const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('schedule_id', req.params.id);
    if (allRoles && count !== null && count >= allRoles.length) {
      await supabase.from('schedules').update({ status: 'scheduled' }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    }

    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/player/join-schedules/:id/requests', async (req: any, res: any) => {
  try {
    if (!req.user || req.user.role !== 'player') return res.status(403).json(err(new Error('请先登录玩家账号')));
    const { data: player, error: playerErr } = await supabase.from('players')
      .select('id, display_name, phone_hash')
      .eq('id', req.user.playerId)
      .maybeSingle();
    if (playerErr) throw playerErr;
    if (!player) return res.status(401).json(err(new Error('玩家账号不存在，请重新登录')));

    const { data: schedule, error: scheduleErr } = await supabase.from('schedules')
      .select('id, tenant_id, script_id, player_count')
      .eq('id', req.params.id)
      .maybeSingle();
    if (scheduleErr) throw scheduleErr;
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));

    const roleName = cleanText(req.body?.roleName, 80) || null;
    if (roleName) {
      const { data: role } = await supabase.from('script_player_roles')
        .select('id')
        .eq('script_id', schedule.script_id)
        .eq('role_name', roleName)
        .maybeSingle();
      if (!role) return res.status(400).json(err(new Error('这个角色不在当前排期可选范围内')));
      const { data: taken } = await supabase.from('checkins')
        .select('id')
        .eq('schedule_id', schedule.id)
        .eq('role', roleName)
        .maybeSingle();
      if (taken) return res.status(409).json(err(new Error('这个角色已经有人上车了')));
    }

    const { data: existing } = await supabase.from('jzg_carpool_join_requests')
      .select('*')
      .eq('schedule_id', schedule.id)
      .eq('player_id', player.id)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();
    if (existing) return res.json(ok({ request: existing, existing: true }));

    const { data, error } = await supabase.from('jzg_carpool_join_requests').insert({
      tenant_id: schedule.tenant_id,
      schedule_id: schedule.id,
      player_id: player.id,
      display_name: player.display_name || '玩家',
      phone_hash: player.phone_hash || null,
      role_name: roleName,
      note: cleanText(req.body?.note, 500) || null,
      status: 'pending',
      source: cleanText(req.body?.source, 40) || 'qr_join',
    }).select().single();
    if (error) throw error;
    res.json(ok({ request: data, existing: false }));
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
  res.status(410).json(err(new Error('旧验证码上车入口已停用，请使用玩家账号登录')));
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
  try {
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const { data } = await supabase.from('evaluations').select('*').eq('schedule_id', req.params.id).order('created_at', { ascending: false });
    res.json(ok(data));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/schedules/:id/evaluate', async (req: any, res: any) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = cleanText(req.body?.comment, 1000);
    if (!req.user?.playerId) return res.status(401).json(err(new Error('请先登录玩家账号')));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json(err(new Error('评分必须在 1 到 5 分之间')));
    const { data: schedule } = await supabase.from('schedules')
      .select('id,tenant_id,status')
      .eq('id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .maybeSingle();
    if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    if (!['completed', 'settling', 'ongoing'].includes(publicScheduleStatus(schedule.status))) {
      return res.status(400).json(err(new Error('当前排期暂不能评价')));
    }
    const { data: player, error: playerErr } = await supabase.from('players')
      .select('id,display_name')
      .eq('id', req.user.playerId)
      .eq('tenant_id', schedule.tenant_id)
      .maybeSingle();
    if (playerErr) throw playerErr;
    if (!player) return res.status(401).json(err(new Error('玩家账号不存在，请重新登录')));
    const { data: checkin } = await supabase.from('checkins')
      .select('id,guest_name')
      .eq('schedule_id', req.params.id)
      .eq('player_id', player.id)
      .maybeSingle();
    if (!checkin) return res.status(403).json(err(new Error('只有已报名玩家可以评价')));
    const { data: existing } = await supabase.from('evaluations')
      .select('id')
      .eq('schedule_id', req.params.id)
      .eq('player_id', player.id)
      .maybeSingle();
    if (existing) return res.status(409).json(err(new Error('你已经评价过这场')));
    const { error: insertErr } = await supabase.from('evaluations').insert({
      schedule_id: req.params.id,
      player_id: player.id,
      checkin_id: checkin.id,
      guest_name: cleanText(player.display_name, 80) || cleanText(checkin.guest_name, 80) || '玩家',
      rating,
      comment: comment || null,
    });
    if (insertErr) {
      if (String(insertErr.code || '') === '23505') return res.status(409).json(err(new Error('你已经评价过这场')));
      throw insertErr;
    }
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/schedules/:id/positive-feedbacks', async (req: any, res: any) => {
  try {
    const schedule = await requireTenantSchedule(req, res, req.params.id);
    if (!schedule) return;
    const { data, error } = await supabase.from('jzg_positive_feedbacks')
      .select('*')
      .eq('schedule_id', req.params.id)
      .eq('tenant_id', currentTenantId(req))
      .order('feedback_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/uploads/positive-feedback', async (req: any, res: any) => {
  try {
    const url = await saveUploadDataUrl(req.body?.dataUrl, 'positive-feedback');
    res.json(ok({ url }));
  } catch (e) { res.status(400).json(err(e)); }
});
app.post('/api/schedules/:id/positive-feedbacks', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const schedule = await requireTenantSchedule(req, res, req.params.id, 'id, tenant_id');
    if (!schedule) return;
    const platform = cleanText(req.body.platform, 60);
    const targetName = cleanText(req.body.targetName, 100);
    const content = cleanText(req.body.content, 1000);
    const screenshotUrl = cleanText(req.body.screenshotUrl, 500) || null;
    if (!platform) return res.status(400).json(err(new Error('请选择或填写好评平台')));
    if (!targetName) return res.status(400).json(err(new Error('请填写好评给到谁')));
    const { data, error } = await supabase.from('jzg_positive_feedbacks').insert({
      tenant_id: tenantId,
      schedule_id: req.params.id,
      platform,
      target_name: targetName,
      content: content || null,
      screenshot_url: screenshotUrl,
      feedback_at: req.body.feedbackAt || new Date().toISOString(),
      created_by: req.user?.adminUserId || req.user?.email || null,
    }).select().single();
    if (error) throw error;
    await logStoreAction(req, 'positive_feedback_created', { type: 'schedule', id: req.params.id }, { platform, targetName });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id/evaluations', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: script } = await supabase.from('scripts').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!script) return res.status(404).json(err(new Error('剧本不存在')));
    const { data } = await supabase.from('evaluations')
      .select('*, schedules!inner(script_id, tenant_id, start_time)')
      .eq('schedules.script_id', req.params.id)
      .eq('schedules.tenant_id', tenantId)
      .order('created_at', { ascending: false });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/scripts/:id/evaluation-stats', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: script } = await supabase.from('scripts').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
    if (!script) return res.status(404).json(err(new Error('剧本不存在')));
    const { data } = await supabase.from('evaluations')
      .select('rating, schedules!inner(script_id, tenant_id)')
      .eq('schedules.script_id', req.params.id)
      .eq('schedules.tenant_id', tenantId);
    const ratings = (data || []).map((r: any) => r.rating);
    if (!ratings.length) return res.json(ok({ total: 0, avgRating: null, minRating: null, maxRating: null }));
    res.json(ok({ total: ratings.length, avgRating: Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10, minRating: Math.min(...ratings), maxRating: Math.max(...ratings) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/evaluations', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: schedules, error: scheduleErr } = await supabase.from('schedules')
      .select('id, script_id, room_id, scheduled_date, start_time, end_time, status, store_car_sequence, created_at')
      .eq('tenant_id', tenantId)
      .order('scheduled_date', { ascending: false })
      .limit(500);
    if (scheduleErr) throw scheduleErr;
    const scheduleRows = schedules || [];
    if (!scheduleRows.length) return res.json(ok({ evaluations: [], stats: { total: 0, avgRating: null }, scriptStats: [], carStats: [] }));

    const scheduleIds = scheduleRows.map((schedule: any) => schedule.id);
    const scriptIds = Array.from(new Set(scheduleRows.map((schedule: any) => cleanText(schedule.script_id, 80)).filter(Boolean)));
    const roomIds = Array.from(new Set(scheduleRows.map((schedule: any) => cleanText(schedule.room_id, 80)).filter(Boolean)));
    const sequenceMap = await computeCarSequenceMap(tenantId, scheduleRows);

    const [{ data: evaluations, error: evalErr }, { data: scripts, error: scriptErr }, { data: rooms, error: roomErr }] = await Promise.all([
      supabase.from('evaluations').select('*').in('schedule_id', scheduleIds).order('created_at', { ascending: false }).limit(500),
      scriptIds.length ? supabase.from('scripts').select('id,name').in('id', scriptIds) : Promise.resolve({ data: [], error: null } as any),
      roomIds.length ? supabase.from('rooms').select('id,name').in('id', roomIds) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (evalErr) throw evalErr;
    if (scriptErr) throw scriptErr;
    if (roomErr) throw roomErr;

    const schedulesById = new Map(scheduleRows.map((schedule: any) => [schedule.id, schedule]));
    const scriptsById = new Map((scripts || []).map((script: any) => [script.id, script]));
    const roomsById = new Map((rooms || []).map((room: any) => [room.id, room]));
    const rows = (evaluations || []).map((item: any) => {
      const schedule = schedulesById.get(item.schedule_id) as any;
      const script = schedule ? scriptsById.get(schedule.script_id) as any : null;
      const room = schedule ? roomsById.get(schedule.room_id) as any : null;
      return {
        ...item,
        schedule: schedule ? {
          id: schedule.id,
          startTime: `${schedule.scheduled_date}T${schedule.start_time}`,
          endTime: `${schedule.scheduled_date}T${schedule.end_time}`,
          status: schedule.status,
          computedCarSequence: sequenceMap.get(schedule.id) || null,
          scriptName: script?.name || '未知剧本',
          roomName: room?.name || null,
        } : null,
      };
    });

    const ratings = rows.map((item: any) => Number(item.rating || 0)).filter((rating: number) => rating > 0);
    const byScript = new Map<string, { scriptName: string; ratings: number[]; count: number }>();
    for (const item of rows) {
      const key = item.schedule?.scriptName || '未知剧本';
      const current = byScript.get(key) || { scriptName: key, ratings: [], count: 0 };
      current.count += 1;
      if (Number(item.rating) > 0) current.ratings.push(Number(item.rating));
      byScript.set(key, current);
    }
    const scriptStats = Array.from(byScript.values()).map(item => ({
      scriptName: item.scriptName,
      count: item.count,
      avgRating: item.ratings.length ? Math.round((item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length) * 10) / 10 : null,
    })).sort((a, b) => b.count - a.count);
    const byCar = new Map<string, { scheduleId: string; scriptName: string; roomName?: string | null; carSequence: number | null; startTime: string; ratings: number[]; count: number }>();
    for (const item of rows) {
      if (!item.schedule?.id) continue;
      const current = byCar.get(item.schedule.id) || {
        scheduleId: item.schedule.id,
        scriptName: item.schedule.scriptName || '未知剧本',
        roomName: item.schedule.roomName || null,
        carSequence: item.schedule.computedCarSequence || null,
        startTime: item.schedule.startTime,
        ratings: [],
        count: 0,
      };
      current.count += 1;
      if (Number(item.rating) > 0) current.ratings.push(Number(item.rating));
      byCar.set(item.schedule.id, current);
    }
    const carStats = Array.from(byCar.values()).map(item => ({
      scheduleId: item.scheduleId,
      scriptName: item.scriptName,
      roomName: item.roomName,
      carSequence: item.carSequence,
      startTime: item.startTime,
      count: item.count,
      avgRating: item.ratings.length ? Math.round((item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length) * 10) / 10 : null,
    })).sort((a, b) => String(b.startTime || '').localeCompare(String(a.startTime || '')));

    res.json(ok({
      evaluations: rows,
      stats: {
        total: rows.length,
        avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      },
      scriptStats,
      carStats,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Customers =====
app.get('/api/membership-packages', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('jzg_membership_packages')
      .select('*')
      .eq('tenant_id', currentTenantId(req))
      .order('recharge_amount', { ascending: true });
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/membership-packages', async (req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_membership_packages').insert({
      tenant_id: currentTenantId(req),
      name: cleanText(req.body?.name, 80) || '未命名套餐',
      recharge_amount: moneyCents(req.body?.rechargeAmount),
      bonus_amount: moneyCents(req.body?.bonusAmount),
      lock_dm_credits: moneyCents(req.body?.lockDmCredits),
      description: cleanText(req.body?.description, 300) || null,
      is_active: req.body?.isActive !== false,
    }).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/membership-packages/:id', async (req: any, res: any) => {
  try {
    const fields: any = {};
    if (req.body.name !== undefined) fields.name = cleanText(req.body.name, 80) || '未命名套餐';
    if (req.body.rechargeAmount !== undefined) fields.recharge_amount = moneyCents(req.body.rechargeAmount);
    if (req.body.bonusAmount !== undefined) fields.bonus_amount = moneyCents(req.body.bonusAmount);
    if (req.body.lockDmCredits !== undefined) fields.lock_dm_credits = moneyCents(req.body.lockDmCredits);
    if (req.body.description !== undefined) fields.description = cleanText(req.body.description, 300) || null;
    if (req.body.isActive !== undefined) fields.is_active = Boolean(req.body.isActive);
    fields.updated_at = new Date().toISOString();
    await supabase.from('jzg_membership_packages').update(fields).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/membership-packages/:id', async (req: any, res: any) => {
  try {
    await supabase.from('jzg_membership_packages').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/marketing-items', async (req: any, res: any) => {
  try {
    const { data } = await supabase.from('jzg_marketing_items')
      .select('*')
      .eq('tenant_id', currentTenantId(req))
      .order('created_at', { ascending: false });
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/marketing-items', async (req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('jzg_marketing_items').insert({
      tenant_id: currentTenantId(req),
      name: cleanText(req.body?.name, 100) || '未命名项目',
      item_type: cleanText(req.body?.itemType, 40) || 'custom',
      price_amount: moneyCents(req.body?.priceAmount),
      bonus_amount: moneyCents(req.body?.bonusAmount),
      lock_dm_credits: moneyCents(req.body?.lockDmCredits),
      description: cleanText(req.body?.description, 500) || null,
      is_active: req.body?.isActive !== false,
    }).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

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
    const { data } = await supabase.from('customers').insert({
      name: cleanText(req.body.name, 80),
      phone: cleanText(req.body.phone, 40) || null,
      membership_level: cleanText(req.body.membershipLevel, 40) || 'none',
      balance: signedMoneyCents(req.body.balance),
      bonus_balance: signedMoneyCents(req.body.bonusBalance),
      lock_dm_credits: moneyCents(req.body.lockDmCredits),
      tenant_id: currentTenantId(req),
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/customers/:id', async (req: any, res: any) => {
  try {
    const fields: any = {};
    if (req.body.name !== undefined) fields.name = cleanText(req.body.name, 80);
    if (req.body.phone !== undefined) fields.phone = cleanText(req.body.phone, 40) || null;
    if (req.body.membershipLevel !== undefined) fields.membership_level = cleanText(req.body.membershipLevel, 40) || 'none';
    if (req.body.balance !== undefined) fields.balance = signedMoneyCents(req.body.balance);
    if (req.body.bonusBalance !== undefined) fields.bonus_balance = signedMoneyCents(req.body.bonusBalance);
    if (req.body.lockDmCredits !== undefined) fields.lock_dm_credits = moneyCents(req.body.lockDmCredits);
    fields.updated_at = new Date().toISOString();
    await supabase.from('customers').update(fields).eq('id', req.params.id).eq('tenant_id', currentTenantId(req));
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/customers/:id', async (req: any, res: any) => {
  try { await supabase.from('customers').delete().eq('id', req.params.id).eq('tenant_id', currentTenantId(req)); res.json(ok()); }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/customers/:id/transactions', async (req: any, res: any) => {
  try {
    if (!useTencentPg) return res.status(503).json(err(new Error('会员交易当前只允许在正式 PostgreSQL 主库执行')));
    const tenantId = currentTenantId(req);
    const transactionType = cleanText(req.body?.transactionType, 40) || 'recharge';
    const paymentMethod = cleanText(req.body?.paymentMethod, 40) || null;
    const packageId = cleanText(req.body?.packageId, 80) || null;
    const scheduleId = cleanText(req.body?.scheduleId, 80) || null;
    const idempotencyKey = cleanText(req.body?.idempotencyKey || req.headers['idempotency-key'], 120) || crypto.randomUUID();
    const data = await createCustomerTransactionOnPostgres({
      tenantId,
      customerId: req.params.id,
      transactionType,
      amount: signedMoneyCents(req.body?.amount),
      bonusAmount: transactionType === 'adjust' ? signedMoneyCents(req.body?.bonusAmount) : moneyCents(req.body?.bonusAmount),
      lockDmCredits: transactionType === 'adjust' ? signedMoneyCents(req.body?.lockDmCredits) : moneyCents(req.body?.lockDmCredits),
      paymentMethod,
      packageId,
      scheduleId,
      note: cleanText(req.body?.note, 300) || null,
      idempotencyKey,
    });
    await logStoreAction(req, 'customer_transaction_created', { type: 'customer', id: req.params.id }, {
      transactionId: data?.id,
      transactionType,
      idempotencyKey,
    });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ===== Notifications =====
app.get('/api/notifications', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data: notifications } = await supabase.from('notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_read', 0);
    res.json(ok({ notifications: notifications || [], unreadCount: count || 0 }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/notifications/:id/read', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    await supabase.from('notifications').update({ is_read: 1, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('tenant_id', tenantId);
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/notifications/read-all', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    await supabase.from('notifications').update({ is_read: 1, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('is_read', 0);
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});

// ===== Conflicts =====
app.get('/api/conflicts', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const status = cleanText(req.query.status, 30);
    let query = supabase.from('conflict_records')
      .select('*, customers(name), actors(name), schedules(script_id, scheduled_date, start_time, scripts(name))')
      .eq('tenant_id', tenantId)
      .order('conflict_date', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/conflicts/pending', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data } = await supabase.from('conflict_records')
      .select('*, customers(name), actors(name), schedules(script_id, scheduled_date, start_time, scripts(name))')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('conflict_date', { ascending: false });
    res.json(ok(data || []));
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/conflicts', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const scheduleId = cleanText(req.body.scheduleId, 80) || null;
    const customerId = cleanText(req.body.customerId, 80) || null;
    const actorId = cleanText(req.body.actorId, 80) || null;
    if (scheduleId) {
      const { data: schedule } = await supabase.from('schedules').select('id').eq('id', scheduleId).eq('tenant_id', tenantId).maybeSingle();
      if (!schedule) return res.status(404).json(err(new Error('排期不存在')));
    }
    if (customerId) {
      const { data: customer } = await supabase.from('customers').select('id').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle();
      if (!customer) return res.status(404).json(err(new Error('客户不存在')));
    }
    if (actorId) {
      const { data: actor } = await supabase.from('actors').select('id').eq('id', actorId).eq('tenant_id', tenantId).maybeSingle();
      if (!actor) return res.status(404).json(err(new Error('卡司不存在')));
    }
    const { data } = await supabase.from('conflict_records').insert({
      tenant_id: tenantId,
      schedule_id: scheduleId,
      customer_id: customerId,
      actor_id: actorId,
      conflict_type: cleanText(req.body.conflictType, 40),
      conflict_description: cleanText(req.body.conflictDescription, 1000),
      conflict_date: req.body.conflictDate || new Date().toISOString(),
      status: 'pending'
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/conflicts/:id/resolve', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const { data, error } = await supabase.from('conflict_records').update({
      resolution: cleanText(req.body.resolution, 1000) || null,
      resolved_by: cleanText(req.body.resolved_by, 80) || null,
      resolved_at: new Date().toISOString(),
      status: cleanText(req.body.status, 30) || 'resolved',
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('tenant_id', tenantId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json(err(new Error('矛盾记录不存在')));
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});
app.put('/api/conflicts/:id', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    const fields: any = {};
    if (req.body.conflictType !== undefined) fields.conflict_type = cleanText(req.body.conflictType, 40);
    if (req.body.conflictDescription !== undefined) fields.conflict_description = cleanText(req.body.conflictDescription, 1000);
    if (req.body.conflictDate !== undefined) fields.conflict_date = req.body.conflictDate;
    if (req.body.status !== undefined) fields.status = cleanText(req.body.status, 30);
    if (req.body.resolveNote !== undefined) fields.resolve_note = cleanText(req.body.resolveNote, 1000);
    if (req.body.scheduleId !== undefined) fields.schedule_id = req.body.scheduleId;
    if (req.body.customerId !== undefined) fields.customer_id = req.body.customerId;
    if (req.body.actorId !== undefined) fields.actor_id = req.body.actorId;
    fields.updated_at = new Date().toISOString();
    await supabase.from('conflict_records').update(fields).eq('id', req.params.id).eq('tenant_id', tenantId);
    res.json(ok());
  }
  catch (e) { res.status(500).json(err(e)); }
});
app.delete('/api/conflicts/:id', async (req: any, res: any) => {
  try {
    const tenantId = currentTenantId(req);
    await supabase.from('conflict_records').delete().eq('id', req.params.id).eq('tenant_id', tenantId);
    res.json(ok());
  }
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
    const actorTenantId = cleanText(actor.tenant_id, 80) || TENANT_ID;
    const token = jwt.sign({ role: 'dm', actorId: actor.id, tenantId: actorTenantId }, JWT_SECRET, { expiresIn: '24h' });
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
    const actorId = cleanText(req.user?.actorId || (req.user?.role === 'admin' ? req.query.actorId : ''), 80);
    const tenantId = currentTenantId(req);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));

    const { data: actor, error: actorErr } = await supabase.from('actors')
      .select('*')
      .eq('id', actorId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (actorErr) throw actorErr;
    if (!actor) return res.status(404).json(err(new Error('DM 不存在')));

    const { data: assignmentRows, error: assignmentErr } = await supabase.from('schedule_actors')
      .select('id, role_name, start_time, end_time, dm_confirmed_at, arrived_at, prep_checked_at, players_ready_at, started_by_dm_at, heartbuild_done_at, current_act, total_acts, ended_by_dm_at, checkout_confirmed_at, props_checked, costumes_checked, script_cards_checked, review_requested, debrief_done, left_at, schedules!inner(id, tenant_id, scheduled_date, start_time, end_time, status, player_count, customer_name, note, script_id, room_id, scripts(id, name), rooms(id, name))')
      .eq('actor_id', actorId)
      .eq('schedules.tenant_id', tenantId);
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
        execution: {
          confirmedAt: row.dm_confirmed_at || null,
          arrivedAt: row.arrived_at || null,
          prepCheckedAt: row.prep_checked_at || null,
          playersReadyAt: row.players_ready_at || null,
          startedAt: row.started_by_dm_at || null,
          heartbuildDoneAt: row.heartbuild_done_at || null,
          currentAct: Number(row.current_act || 0),
          totalActs: Number(row.total_acts || 0),
          endedAt: row.ended_by_dm_at || null,
          checkoutConfirmedAt: row.checkout_confirmed_at || null,
          propsChecked: row.props_checked === true,
          costumesChecked: row.costumes_checked === true,
          scriptCardsChecked: row.script_cards_checked === true,
          reviewRequested: row.review_requested === true,
          debriefDone: row.debrief_done === true,
          leftAt: row.left_at || null,
        },
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
    const learningQuery = await supabase.from('jzg_actor_learning_tasks')
      .select('*, scripts(name)')
      .eq('actor_id', actorId)
      .eq('tenant_id', tenantId)
      .in('status', ['assigned', 'in_progress', 'submitted'])
      .order('due_date', { ascending: true })
      .limit(8);
    if (learningQuery.error && !isMissingRelationError(learningQuery.error, 'jzg_actor_learning_tasks')) throw learningQuery.error;
    const learningTasks = (learningQuery.data || []).map((task: any) => ({
      id: `learning-${task.id}`,
      title: task.title || `学习 ${relationName(task, 'scripts') || '未命名剧本'}`,
      dueAt: task.due_date || null,
      dueLabel: task.due_date || '未设截止',
      priority: task.status === 'submitted' ? 'high' : 'normal',
      status: ({ assigned: '待开始', in_progress: '学习中', submitted: '待考核' } as Record<string, string>)[task.status] || task.status,
      source: '学本',
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
    const tasks = [...upcomingTasks, ...learningTasks, ...skillTasks].slice(0, 10);

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

app.post('/api/dm/schedules/:id/action', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.user?.actorId, 80);
    const tenantId = currentTenantId(req);
    const scheduleId = cleanText(req.params.id, 80);
    const action = cleanText(req.body?.action, 40);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));
    const { data: assignment, error: assignmentErr } = await supabase.from('schedule_actors')
      .select('id, schedule_id, actor_id, schedules!inner(id, tenant_id, status)')
      .eq('schedule_id', scheduleId)
      .eq('actor_id', actorId)
      .eq('schedules.tenant_id', tenantId)
      .maybeSingle();
    if (assignmentErr) throw assignmentErr;
    if (!assignment) return res.status(404).json(err(new Error('未找到你的这场排班')));
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    const schedulePatch: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};
    if (action === 'confirm_assignment') patch.dm_confirmed_at = now;
    else if (action === 'arrive_prepare') {
      patch.arrived_at = now;
      patch.prep_checked_at = now;
    } else if (action === 'players_ready') patch.players_ready_at = now;
    else if (action === 'start_game') {
      patch.started_by_dm_at = now;
      schedulePatch.status = 'ongoing';
      schedulePatch.actual_started_at = now;
    } else if (action === 'heartbuild_done') patch.heartbuild_done_at = now;
    else if (action === 'act_update') {
      const currentAct = Math.max(1, Number(req.body?.currentAct || 1));
      const totalActs = Math.max(currentAct, Number(req.body?.totalActs || currentAct));
      patch.current_act = currentAct;
      patch.total_acts = totalActs;
      metadata.currentAct = currentAct;
      metadata.totalActs = totalActs;
    } else if (action === 'end_game') {
      patch.ended_by_dm_at = now;
      schedulePatch.status = 'settling';
      schedulePatch.actual_ended_at = now;
    } else if (action === 'checkout_confirm') patch.checkout_confirmed_at = now;
    else if (action === 'wrapup_confirm') {
      patch.props_checked = Boolean(req.body?.propsChecked);
      patch.costumes_checked = Boolean(req.body?.costumesChecked);
      patch.script_cards_checked = Boolean(req.body?.scriptCardsChecked);
      patch.review_requested = Boolean(req.body?.reviewRequested);
      patch.debrief_done = Boolean(req.body?.debriefDone);
      patch.left_at = now;
      schedulePatch.props_checked = patch.props_checked;
      schedulePatch.costumes_checked = patch.costumes_checked;
      schedulePatch.script_cards_checked = patch.script_cards_checked;
      schedulePatch.review_requested = patch.review_requested;
      schedulePatch.debrief_done = patch.debrief_done;
      schedulePatch.actual_left_at = now;
    } else {
      return res.status(400).json(err(new Error('DM 动作无效')));
    }
    if (Object.keys(patch).length) {
      await supabase.from('schedule_actors').update(patch).eq('id', assignment.id);
    }
    if (Object.keys(schedulePatch).length) {
      await supabase.from('schedules').update(schedulePatch).eq('id', scheduleId).eq('tenant_id', tenantId);
    }
    await supabase.from('jzg_schedule_execution_logs').insert({
      tenant_id: tenantId,
      schedule_id: scheduleId,
      actor_id: actorId,
      action,
      metadata,
    });
    res.json(ok({ action, at: now }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/dm/leave-requests', async (req: any, res: any) => {
  try {
    const actorId = cleanText(req.user?.actorId, 80);
    const tenantId = currentTenantId(req);
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
      tenant_id: tenantId,
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
    const tenantId = currentTenantId(req);
    if (!actorId) return res.status(403).json(err(new Error('缺少 DM 身份')));
    const scheduleId = cleanText(req.body?.scheduleId, 80);
    let scriptId = cleanText(req.body?.scriptId, 80) || null;
    let scriptName = cleanText(req.body?.scriptName, 120);

    if (scheduleId) {
      const { data: assignment, error: assignmentErr } = await supabase.from('schedule_actors')
        .select('schedules!inner(id, tenant_id, script_id, scripts(id, name))')
        .eq('actor_id', actorId)
        .eq('schedule_id', scheduleId)
        .eq('schedules.tenant_id', tenantId)
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
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'dm_experience_note_submit',
      targetType: 'dm_experience_note',
      texts: { scriptName, title, content, tags: tags.join(' ') },
    });
    const { data, error } = await supabase.from('jzg_dm_experience_notes').insert({
      tenant_id: tenantId,
      actor_id: actorId,
      schedule_id: scheduleId || null,
      script_id: scriptId,
      script_name: scriptName,
      title,
      content,
      tags,
      visibility,
      moderation_precheck: moderationPrecheck,
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
    const playerTenantId = await tenantIdFromRequest(req);
    let { data: p } = await supabase.from('players').select('*').eq('phone_hash', phoneHash).eq('tenant_id', playerTenantId).maybeSingle();
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
        tenant_id: playerTenantId,
      };
      if (hasCode) {
        insertPayload.auth_provider = 'phone';
        insertPayload.phone_verified_at = nowIso;
      }
      const r = await supabase.from('players').insert(insertPayload).select().single();
      p = r.data;
    }
    const token = jwt.sign({ role: 'player', playerId: p!.id, tenantId: playerTenantId }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({ token, player: { id: p!.id, displayName: p!.display_name, phone: verifiedPhone, totalGames: p!.total_games || 0 } }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/player/schedules', async (req: any, res: any) => {
  try {
    if (!req.user || req.user.role !== 'player') return res.status(403).json(err(new Error('无权限')));
    const tenantId = currentTenantId(req);
    const { data: player } = await supabase.from('players').select('id').eq('id', req.user.playerId).eq('tenant_id', tenantId).maybeSingle();
    if (!player) return res.status(401).json(err(new Error('玩家账号不存在，请重新登录')));
    const { data, error } = await supabase.from('checkins')
      .select('id, role, checked_at, schedules!inner(id, tenant_id, scheduled_date, start_time, end_time, status, player_count, script_id, room_id, scripts(name), rooms(name))')
      .eq('player_id', player.id)
      .eq('schedules.tenant_id', tenantId)
      .order('checked_at', { ascending: false });
    if (error) throw error;
    res.json(ok((data || []).map((c: any) => ({
      checkinId: c.id, role: c.role, checkedAt: c.checked_at,
      schedule: c.schedules ? { id: c.schedules.id, scriptName: c.schedules.scripts?.name, roomName: c.schedules.rooms?.name, startTime: c.schedules.start_time, endTime: c.schedules.end_time, status: c.schedules.status, customerName: null, playerCount: c.schedules.player_count } : null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.use((error: unknown, _req: any, res: any, next: any) => {
  if (res.headersSent) return next(error);
  const message = error instanceof Error ? error.message : String(error || '');
  if (/request entity too large/i.test(message)) {
    return res.status(413).json(err(new Error('提交内容过大')));
  }
  if (/CORS origin denied/i.test(message)) {
    return res.status(403).json(err(new Error('当前来源不允许访问此接口')));
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json(err(new Error('请求内容格式不正确')));
  }
  console.error('[api] unhandled middleware error', message);
  return res.status(500).json({ success: false, error: '服务器错误，请稍后重试' });
});

export default app;
