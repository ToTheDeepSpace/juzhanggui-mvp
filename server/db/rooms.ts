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

export const RoomDB = {
  getAll: async () => db.all('SELECT * FROM rooms ORDER BY name'),
  getById: async (id: string) => db.get('SELECT * FROM rooms WHERE id = ?', id),
  create: async (name: string, capacity?: number) => {
    const id = uuidv4();
    await db.run('INSERT INTO rooms (id, name, capacity) VALUES (?, ?, ?)', id, name, capacity || 0);
    return id;
  },
  update: async (id: string, name: string, capacity?: number) => {
    await db.run('UPDATE rooms SET name = ?, capacity = ? WHERE id = ?', name, capacity || 0, id);
  },
  delete: async (id: string) => db.run('DELETE FROM rooms WHERE id = ?', id)
};
