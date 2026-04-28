import express from 'express';
import cors from 'cors';
import { ScheduleDB, NotificationDB } from './db';
import { authMiddleware } from './middleware/auth';

// 路由模块
import authRouter from './routes/auth';
import roomsRouter from './routes/rooms';
import actorsRouter from './routes/actors';
import scriptsRouter from './routes/scripts';
import schedulesRouter from './routes/schedules';
import checkinsRouter from './routes/checkins';
import batchRouter from './routes/batch';
import customersRouter from './routes/customers';
import preferencesRouter from './routes/preferences';
import conflictsRouter from './routes/conflicts';
import remindersRouter from './routes/reminders';
import evaluationsRouter from './routes/evaluations';
import notificationsRouter from './routes/notifications';
import schedulesAdminRouter from './routes/schedules_admin';

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

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

// 启动时自动清理
setTimeout(async () => {
  try {
    const count = await ScheduleDB.cleanupExpiredPending();
    if (count > 0) console.log(`[cleanup] ${count} expired pending schedules removed`);
  } catch { /* silent */ }
}, 2000);

// 定时检查排期状态
setInterval(async () => {
  try {
    const now = new Date().toISOString();
    const started = await ScheduleDB.getStartedSchedules(now);
    for (const s of started) {
      await ScheduleDB.update(s.id, { status: 'ongoing' });
      await NotificationDB.create('schedule_start', '排期已开始', `${s.script_name || '未知剧本'} 已开始`, s.id);
    }
    const ended = await ScheduleDB.getEndedSchedules(now);
    for (const s of ended) {
      await ScheduleDB.update(s.id, { status: 'completed' });
      await NotificationDB.create('schedule_end', '排期已结束', `${s.script_name || '未知剧本'} 已结束`, s.id);
    }
  } catch (error) {
    console.error('Schedule checker error:', error);
  }
}, 60000);

// Vercel Serverless 导出
export default app;

// 本地开发端口
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}
