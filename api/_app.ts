// ==========================================
// 共享 Express App — Vercel + 本地开发共用
// 所有路由注册在此统一维护
// ==========================================

import express from 'express';
import cors from 'cors';
import { ScheduleDB, NotificationDB } from '../server/db';
import { authMiddleware } from '../server/middleware/auth';

// 路由模块
import authRouter from '../server/routes/auth';
import roomsRouter from '../server/routes/rooms';
import actorsRouter from '../server/routes/actors';
import scriptsRouter from '../server/routes/scripts';
import schedulesRouter from '../server/routes/schedules';
import checkinsRouter from '../server/routes/checkins';
import batchRouter from '../server/routes/batch';
import customersRouter from '../server/routes/customers';
import preferencesRouter from '../server/routes/preferences';
import conflictsRouter from '../server/routes/conflicts';
import remindersRouter from '../server/routes/reminders';
import evaluationsRouter from '../server/routes/evaluations';
import notificationsRouter from '../server/routes/notifications';
import schedulesAdminRouter from '../server/routes/schedules_admin';
import playerRouter from '../server/routes/player';

const app = express();
app.use(cors());
app.use(express.json());

// 认证中间件
app.use(authMiddleware);

// 注册路由
app.use('/', authRouter);
app.use('/', roomsRouter);
app.use('/', actorsRouter);
app.use('/', scriptsRouter);
app.use('/', schedulesRouter);
app.use('/', checkinsRouter);
app.use('/', batchRouter);
app.use('/', customersRouter);
app.use('/', preferencesRouter);
app.use('/', conflictsRouter);
app.use('/', remindersRouter);
app.use('/', evaluationsRouter);
app.use('/', notificationsRouter);
app.use('/', schedulesAdminRouter);
app.use('/', playerRouter);

// ===== 健康检查 =====
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: '服务正常运行' });
});

// ===== 清理过期 pending 排期 =====
app.post('/api/schedules/cleanup', async (_req, res) => {
  try {
    const count = await ScheduleDB.cleanupExpiredPending();
    res.json({ success: true, data: { expired: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default app;
