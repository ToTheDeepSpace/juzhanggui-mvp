import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: any, res: any) => {
  res.json({ success: true, message: 'Serverless OK' });
});

app.post('/api/auth/login', async (req: any, res: any) => {
  const { password } = req.body;
  if (password === 'admin123') {
    const jwt = await import('jsonwebtoken');
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'fallback', { expiresIn: '24h' });
    return res.json({ success: true, data: { token } });
  }
  res.status(401).json({ success: false, error: '密码错误' });
});

app.get('/api/rooms', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('rooms').select('*').order('name');
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default app;
