import { getDb } from './database';
import { v4 as uuidv4 } from 'uuid';

const db = new Proxy({} as any, {
  get(_: any, prop: string) {
    const realDb = getDb();
    if (!realDb) throw new Error("Database not initialized");
    const val = (realDb as any)[prop];
    return typeof val === "function" ? val.bind(realDb) : val;
  },
});

export const NotificationDB = {
  getAll: async (limit = 50) =>
    db.all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?', limit),

  getUnreadCount: async () => {
    const r = await db.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
    return r?.count || 0;
  },

  create: async (type: string, title: string, message: string, scheduleId?: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO notifications (id, type, title, message, schedule_id) VALUES (?, ?, ?, ?, ?)',
      id, type, title, message, scheduleId || null
    );
    return id;
  },

  markRead: async (id: string) =>
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', id),

  markAllRead: async () =>
    db.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0'),
};
