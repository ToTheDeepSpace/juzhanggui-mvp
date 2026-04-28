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

export const ActorDB = {
  getAll: async () => db.all('SELECT * FROM actors ORDER BY name'),
  getById: async (id: string) => db.get('SELECT * FROM actors WHERE id = ?', id),
  create: async (name: string, phone?: string) => {
    const id = uuidv4();
    await db.run('INSERT INTO actors (id, name, phone) VALUES (?, ?, ?)', id, name, phone || null);
    return id;
  },
  update: async (id: string, name: string, phone?: string) => {
    await db.run('UPDATE actors SET name = ?, phone = ? WHERE id = ?', name, phone || null, id);
  },
  delete: async (id: string) => db.run('DELETE FROM actors WHERE id = ?', id)
};


export const ActorSkillDB = {
  getByActor: async (actorId: string) => {
    return db.all(`
      SELECT s.*, scripts.name as script_name, scripts.duration
      FROM actor_skills s
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.actor_id = ?
      ORDER BY scripts.name, s.role_name
    `, actorId);
  },
  getByScript: async (scriptId: string) => {
    return db.all(`
      SELECT s.*, actors.name as actor_name
      FROM actor_skills s
      JOIN actors ON s.actor_id = actors.id
      WHERE s.script_id = ?
      ORDER BY s.role_name, actors.name
    `, scriptId);
  },
  create: async (actorId: string, scriptId: string, roleName: string, roleType: string = 'actor', proficiency?: number) => {
    const id = uuidv4();
    try {
      await db.run(
        'INSERT INTO actor_skills (id, actor_id, script_id, role_name, role_type, proficiency) VALUES (?, ?, ?, ?, ?, ?)',
        id, actorId, scriptId, roleName, roleType, proficiency || 1
      );
      return id;
    } catch (e) {
      return null;
    }
  },
  delete: async (actorId: string, scriptId: string, roleName: string) => {
    await db.run('DELETE FROM actor_skills WHERE actor_id = ? AND script_id = ? AND role_name = ?', actorId, scriptId, roleName);
  }
};
