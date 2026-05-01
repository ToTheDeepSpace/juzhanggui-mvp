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

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: any, res: any) => {
  res.json({ success: true, message: 'Serverless OK' });
});

app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, error: '请输入密码' });
    
    const valid = await bcrypt.compare(password, bcrypt.hashSync('admin123', 10));
    if (!valid) return res.status(401).json({ success: false, error: '密码错误' });
    
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, data: { token } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Placeholder routes — will be replaced with full API
app.get('/api/rooms', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('rooms').select('*').order('name');
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/actors', async (_req: any, res: any) => {
  const { data, error } = await supabase.from('actors').select('*').order('name');
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

app.get('/api/scripts', async (_req: any, res: any) => {
  const { data, error } = await supabase.from('scripts').select('*').order('name');
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// Catch-all for POST/PUT/DELETE
app.all('/api/*', (_req: any, res: any) => {
  res.json({ success: false, error: 'API not yet available in serverless mode' });
});

export default app;
