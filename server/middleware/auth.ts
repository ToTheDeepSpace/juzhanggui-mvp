import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';
const JWT_EXPIRES_IN = '24h';

// 无需登录的公开路径
const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/verify',
];

// 公开路径前缀（所有匹配前缀的路径都开放）
const PUBLIC_PATH_PREFIXES = [
  '/api/schedules/', // 需要区分具体路径
];

// 需要公开的具体路径后缀
const PUBLIC_PATH_SUFFIXES = [
  '/public',
  '/checkin',
  '/evaluate',
  '/evaluation',
];

function isPublicPath(path: string): boolean {
  // 精确匹配
  if (PUBLIC_PATHS.includes(path)) return true;
  
  // 前缀 + 后缀匹配（如 /api/schedules/xxx/public）
  for (const suffix of PUBLIC_PATH_SUFFIXES) {
    if (path.endsWith(suffix)) return true;
  }
  
  // /api/scripts/:id/evaluations 和 /api/scripts/:id/evaluation-stats
  if (path.includes('/scripts/') && (path.endsWith('/evaluations') || path.endsWith('/evaluation-stats'))) {
    return true;
  }
  
  return false;
}

export function generateToken(payload: { role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 公开路径直接放行
  if (isPublicPath(req.path)) {
    return next();
  }

  // OPTIONS 预检请求放行
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

export { JWT_SECRET, JWT_EXPIRES_IN };
