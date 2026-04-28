import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth';

const router = Router();

// 管理员密码哈希（从环境变量读取，默认密码: admin123）
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

// 生成默认密码哈希（首次运行时自动设置）
function getDefaultHash(): string {
  // admin123 的 bcrypt 哈希
  return bcrypt.hashSync('admin123', 10);
}

function getPasswordHash(): string {
  return ADMIN_PASSWORD_HASH || getDefaultHash();
}

// POST /api/auth/login
router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      res.status(400).json({ success: false, error: '请输入密码' });
      return;
    }

    const hash = getPasswordHash();
    const valid = await bcrypt.compare(password, hash);
    
    if (!valid) {
      res.status(401).json({ success: false, error: '密码错误' });
      return;
    }

    const token = generateToken({ role: 'admin' });
    res.json({ success: true, data: { token } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/auth/verify — 验证 token 是否有效
router.get('/api/auth/verify', (req: Request, res: Response) => {
  res.json({ success: true, data: { valid: true } });
});

export default router;
