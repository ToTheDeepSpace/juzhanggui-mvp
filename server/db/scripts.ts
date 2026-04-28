import { getDb } from './database';
import { v4 as uuidv4 } from 'uuid';

export const ScriptDB = {
  getAll: async () => {
    const scripts = await db.all('SELECT id, name, min_duration as duration, min_duration, max_duration, dm_gender, created_at FROM scripts ORDER BY name');
    // 为每个剧本添加角色数量
    for (const script of scripts) {
      const playerRoles = await db.all('SELECT role_name, gender FROM script_player_roles WHERE script_id = ?', script.id);
      const actorRoles = await db.all('SELECT role_name, gender FROM script_actor_roles WHERE script_id = ?', script.id);
      script.player_roles = playerRoles.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      script.actor_roles = actorRoles.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      script.player_count = playerRoles.length;
      script.actor_count = actorRoles.length;
    }
    return scripts;
  },
  getById: async (id: string) => {
    const script = await db.get('SELECT id, name, min_duration as duration, min_duration, max_duration, dm_gender, created_at FROM scripts WHERE id = ?', id);
    if (script) {
      const playerRoles = await db.all('SELECT role_name, gender FROM script_player_roles WHERE script_id = ?', id);
      const actorRoles = await db.all('SELECT role_name, gender FROM script_actor_roles WHERE script_id = ?', id);
      script.player_roles = playerRoles.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      script.actor_roles = actorRoles.map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      script.player_count = playerRoles.length;
      script.actor_count = actorRoles.length;
    }
    return script;
  },
  create: async (name: string, minDuration: number, maxDuration: number, playerRoles: string[] = [], actorRoles: string[] = []) => {
    const id = uuidv4();
    await db.exec('BEGIN TRANSACTION');
    try {
      await db.run('INSERT INTO scripts (id, name, min_duration, max_duration) VALUES (?, ?, ?, ?)', id, name, minDuration, maxDuration);
      
      // 解析玩家角色（可能包含性别信息，格式：角色名(性别)）
      for (const roleStr of playerRoles) {
        const roleMatch = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
        const roleName = roleMatch ? roleMatch[1].trim() : roleStr.trim();
        const gender = roleMatch ? roleMatch[2].trim() : '';
        await db.run('INSERT INTO script_player_roles (id, script_id, role_name, gender) VALUES (?, ?, ?, ?)', 
                     uuidv4(), id, roleName, gender);
      }
      
      // 解析卡司角色
      for (const roleStr of actorRoles) {
        const roleMatch = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
        const roleName = roleMatch ? roleMatch[1].trim() : roleStr.trim();
        const gender = roleMatch ? roleMatch[2].trim() : '';
        await db.run('INSERT INTO script_actor_roles (id, script_id, role_name, gender) VALUES (?, ?, ?, ?)', 
                     uuidv4(), id, roleName, gender);
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err instanceof Error ? err : new Error(String(err));
    }
    return id;
  },
  update: async (id: string, name: string, minDuration: number, maxDuration: number, playerRoles: string[] = [], actorRoles: string[] = []) => {
    await db.exec('BEGIN TRANSACTION');
    try {
      await db.run('UPDATE scripts SET name = ?, min_duration = ?, max_duration = ? WHERE id = ?', name, minDuration, maxDuration, id);
      await db.run('DELETE FROM script_player_roles WHERE script_id = ?', id);
      await db.run('DELETE FROM script_actor_roles WHERE script_id = ?', id);
      
      // 解析玩家角色
      for (const roleStr of playerRoles) {
        const roleMatch = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
        const roleName = roleMatch ? roleMatch[1].trim() : roleStr.trim();
        const gender = roleMatch ? roleMatch[2].trim() : '';
        await db.run('INSERT INTO script_player_roles (id, script_id, role_name, gender) VALUES (?, ?, ?, ?)', 
                     uuidv4(), id, roleName, gender);
      }
      
      // 解析卡司角色
      for (const roleStr of actorRoles) {
        const roleMatch = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
        const roleName = roleMatch ? roleMatch[1].trim() : roleStr.trim();
        const gender = roleMatch ? roleMatch[2].trim() : '';
        await db.run('INSERT INTO script_actor_roles (id, script_id, role_name, gender) VALUES (?, ?, ?, ?)', 
                     uuidv4(), id, roleName, gender);
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  delete: async (id: string) => db.run('DELETE FROM scripts WHERE id = ?', id)
};

export const ScriptRoleDB = {
  getByScript: async (scriptId: string) => {
    return db.all('SELECT * FROM script_roles WHERE script_id = ? ORDER BY start_offset', scriptId);
  },
  create: async (scriptId: string, roleName: string, requiredDuration?: number, startOffset?: number) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO script_roles (id, script_id, role_name, required_duration, start_offset) VALUES (?, ?, ?, ?, ?)',
      id, scriptId, roleName, requiredDuration || null, startOffset || 0
    );
    return id;
  },
  delete: async (id: string) => db.run('DELETE FROM script_roles WHERE id = ?', id)
};

