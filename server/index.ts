// 本地开发入口 — 加载 .env/.env.local + 启动端口监听 + 后台任务
import './loadEnv';
import app from '../api/index';
import { ScheduleDB, NotificationDB } from './db';

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ===== 后台任务（仅本地开发环境，Vercel Serverless 不执行）=====
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
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
}

// Vercel Serverless 导出
export default app;

// 本地开发端口
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}
