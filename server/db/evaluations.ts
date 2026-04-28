import { getDb } from './database';
// lazy db proxy — defers to getDb() at call time
const db = new Proxy({} as any, {
  get(_: any, prop: string) {
    const realDb = getDb();
    if (!realDb) throw new Error("Database not initialized");
    const val = (realDb as any)[prop];
    return typeof val === "function" ? val.bind(realDb) : val;
  },
});
import { v4 as uuidv4 } from 'uuid';

export const EvaluationDB = {
  // 查询某场排期的评价
  getBySchedule: async (scheduleId: string) => {
    return db.all('SELECT * FROM evaluations WHERE schedule_id = ? ORDER BY created_at DESC', scheduleId);
  },
  // 提交或更新评价（每人只能评一次，用 schedule_id + guest_name 唯一）
  upsert: async (scheduleId: string, guestName: string, rating: number, comment?: string) => {
    const id = uuidv4();
    await db.run(
      `INSERT INTO evaluations (id, schedule_id, guest_name, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(schedule_id, guest_name) DO UPDATE SET rating = excluded.rating, comment = excluded.comment`,
      id, scheduleId, guestName, rating, comment || null
    );
  },
  // 查询某剧本的所有评价（含聚合）
  getByScript: async (scriptId: string) => {
    return db.all(`
      SELECT e.*, scripts.name as script_name, s.start_time
      FROM evaluations e
      JOIN schedules s ON e.schedule_id = s.id
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.script_id = ?
      ORDER BY e.created_at DESC
    `, scriptId);
  },
  // 查询某剧本的评分聚合
  getScriptStats: async (scriptId: string) => {
    const result = await db.get(`
      SELECT
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM evaluations e
      JOIN schedules s ON e.schedule_id = s.id
      WHERE s.script_id = ?
    `, scriptId);
    return {
      total: result?.total || 0,
      avgRating: result?.avg_rating ? Math.round(Number(result.avg_rating) * 10) / 10 : null,
      minRating: result?.min_rating || null,
      maxRating: result?.max_rating || null,
    };
  }
};

// 检查冲突的辅助函数
