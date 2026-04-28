import express from 'express';
import cors from 'cors';
import { initDb, getDb, ScheduleDB, NotificationDB } from './db';
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

// 全局异常捕获
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});

const app = express();
app.use(cors());
app.use(express.json());

// 初始化数据库
await initDb();
const db = getDb();

// 认证中间件（保护管理后台 API）
app.use(authMiddleware);

// 注册路由（auth 在最前，公开路径优先）
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
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务正常运行' });
});

// ===== 清理过期 pending 排期 =====
app.post('/api/schedules/cleanup', async (req, res) => {
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
    if (count > 0) console.log(`[cleanup] 已过期 ${count} 条 pending 排期`);
  } catch { /* 静默失败 */ }
}, 2000);

// 定时检查排期状态（scheduled → ongoing → completed）
setInterval(async () => {
  try {
    const now = new Date().toISOString();
    
    // 检查应该开始的排期
    const startedSchedules = await ScheduleDB.getStartedSchedules(now);
    for (const schedule of startedSchedules) {
      await ScheduleDB.update(schedule.id, { status: 'ongoing' });
      await NotificationDB.create(
        'schedule_start',
        '排期已开始',
        `《${schedule.script_name || '未知剧本'}》已开始`,
        schedule.id
      );
      console.log(`[schedule-start] ${schedule.id} → ongoing`);
    }
    
    // 检查应该结束的排期
    const endedSchedules = await ScheduleDB.getEndedSchedules(now);
    for (const schedule of endedSchedules) {
      await ScheduleDB.update(schedule.id, { status: 'completed' });
      await NotificationDB.create(
        'schedule_end',
        '排期已结束',
        `《${schedule.script_name || '未知剧本'}》已结束，记得收款`,
        schedule.id
      );
      console.log(`[schedule-end] ${schedule.id} → completed`);
    }
  } catch (error) {
    console.error('定时检查排期出错:', error);
  }
}, 60000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
