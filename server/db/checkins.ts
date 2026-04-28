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

export const CheckInDB = {
  getBySchedule: async (scheduleId: string) => {
    return db.all(`
      SELECT * FROM checkins 
      WHERE schedule_id = ? 
      ORDER BY checked_at DESC
    `, scheduleId);
  },
  create: async (scheduleId: string, guestName: string, guestPhone?: string, role?: string, guestAvatar?: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO checkins (id, schedule_id, guest_name, guest_phone, role, guest_avatar) VALUES (?, ?, ?, ?, ?, ?)',
      id, scheduleId, guestName, guestPhone || null, role || null, guestAvatar || null
    );
    return id;
  },
  delete: async (id: string) => db.run('DELETE FROM checkins WHERE id = ?', id),
  deleteByGuestAndRole: async (scheduleId: string, guestName: string, role: string) => {
    await db.run(
      'DELETE FROM checkins WHERE schedule_id = ? AND guest_name = ? AND role = ?',
      scheduleId, guestName, role
    );
  },
  getStats: async (scheduleId: string) => {
    const result = await db.get(
      'SELECT COUNT(*) as count FROM checkins WHERE schedule_id = ?',
      scheduleId
    );
    return result?.count || 0;
  }
};

// 评价记录数据库操作
