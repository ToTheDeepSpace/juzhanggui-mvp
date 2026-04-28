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

export const ScheduleDB = {
  getAll: async (startDate?: string, endDate?: string) => {
    let sql = `
      SELECT s.*, 
        rooms.name as room_name,
        scripts.name as script_name, scripts.duration as script_duration,
        (SELECT COUNT(*) FROM checkins c WHERE c.schedule_id = s.id) as checkin_count,
        (SELECT GROUP_CONCAT(role_name) FROM script_player_roles spr WHERE spr.script_id = s.script_id) as player_roles
      FROM schedules s
      LEFT JOIN rooms ON s.room_id = rooms.id
      JOIN scripts ON s.script_id = scripts.id
    `;
    if (startDate && endDate) {
      sql += ' WHERE s.start_time >= ? AND s.start_time <= ? ORDER BY s.start_time';
      return db.all(sql, startDate, endDate);
    }
    sql += ' ORDER BY s.start_time DESC LIMIT 100';
    return db.all(sql);
  },
  getById: async (id: string) => {
    return db.get(`
      SELECT s.*, 
        rooms.name as room_name,
        scripts.name as script_name, scripts.duration as script_duration
      FROM schedules s
      LEFT JOIN rooms ON s.room_id = rooms.id
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.id = ?
    `, id);
  },
  getByRoom: async (roomId: string, startDate: string, endDate: string) => {
    return db.all(`
      SELECT s.*, scripts.name as script_name, scripts.duration as script_duration
      FROM schedules s
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.room_id = ? AND s.start_time >= ? AND s.start_time <= ? AND s.status != 'cancelled'
      ORDER BY s.start_time
    `, roomId, startDate, endDate);
  },
  getByActor: async (actorId: string, startDate: string, endDate: string) => {
    return db.all(`
      SELECT sa.*, s.room_id, s.script_id, s.status,
        rooms.name as room_name,
        scripts.name as script_name
      FROM schedule_actors sa
      JOIN schedules s ON sa.schedule_id = s.id
      LEFT JOIN rooms ON s.room_id = rooms.id
      JOIN scripts ON s.script_id = scripts.id
      WHERE sa.actor_id = ? AND sa.end_time > ? AND sa.start_time < ? AND s.status != 'cancelled'
      ORDER BY sa.start_time
    `, actorId, startDate, endDate);
  },

  // 将超时的 pending 排期标记为 expired
  // 判断：排期开始时间已过但状态仍为 pending，视为超时未确认
  cleanupExpiredPending: async () => {
    const now = new Date().toISOString();
    const result = await db.run(`
      UPDATE schedules SET status = 'expired'
      WHERE status = 'pending' AND start_time < ?
    `, now);
    return result.changes;
  },
  create: async (data: {
    roomId?: string;
    scriptId: string;
    startTime: string;
    endTime: string;
    customerName?: string;
    customerPhone?: string;
    playerCount?: number;
    note?: string;
    status?: string;
  }) => {
    const id = uuidv4();
    await db.run(`
      INSERT INTO schedules (id, room_id, script_id, start_time, end_time, status, customer_name, customer_phone, player_count, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, data.roomId || null, data.scriptId, data.startTime, data.endTime,
      data.status || 'pending', data.customerName || null, data.customerPhone || null, data.playerCount || null, data.note || null);
    return id;
  },
  update: async (id: string, data: Partial<{
    roomId: string;
    scriptId: string;
    startTime: string;
    endTime: string;
    status: string;
    customerName: string;
    customerPhone: string;
    playerCount: number;
    note: string;
  }>) => {
    const sets: string[] = [];
    const values: any[] = [];
    
    if (data.roomId !== undefined) { sets.push('room_id = ?'); values.push(data.roomId || null); }
    if (data.scriptId !== undefined) { sets.push('script_id = ?'); values.push(data.scriptId); }
    if (data.startTime !== undefined) { sets.push('start_time = ?'); values.push(data.startTime); }
    if (data.endTime !== undefined) { sets.push('end_time = ?'); values.push(data.endTime); }
    if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }
    if (data.customerName !== undefined) { sets.push('customer_name = ?'); values.push(data.customerName); }
    if (data.customerPhone !== undefined) { sets.push('customer_phone = ?'); values.push(data.customerPhone); }
    if (data.playerCount !== undefined) { sets.push('player_count = ?'); values.push(data.playerCount); }
    if (data.note !== undefined) { sets.push('note = ?'); values.push(data.note); }
    
    values.push(id);
    await db.run(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`, values);
  },
  delete: async (id: string) => db.run('DELETE FROM schedules WHERE id = ?', id),
  confirm: async (id: string, roomId: string) => {
    await db.run(
      'UPDATE schedules SET room_id = ?, status = ? WHERE id = ?',
      roomId, 'scheduled', id
    );
  },

  // 获取已开始但状态仍为 scheduled 的排期
  getStartedSchedules: async (nowISO: string) => {
    return db.all(`
      SELECT s.*, scripts.name as script_name
      FROM schedules s
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.status = 'scheduled' AND s.start_time <= ?
      ORDER BY s.start_time
    `, nowISO);
  },

  // 获取已结束但状态仍为 ongoing 的排期
  getEndedSchedules: async (nowISO: string) => {
    return db.all(`
      SELECT s.*, scripts.name as script_name
      FROM schedules s
      JOIN scripts ON s.script_id = scripts.id
      WHERE s.status = 'ongoing' AND s.end_time <= ?
      ORDER BY s.end_time
    `, nowISO);
  }
};


export const ScheduleActorDB = {
  getBySchedule: async (scheduleId: string) => {
    return db.all(`
      SELECT sa.*, actors.name as actor_name
      FROM schedule_actors sa
      JOIN actors ON sa.actor_id = actors.id
      WHERE sa.schedule_id = ?
    `, scheduleId);
  },
  create: async (scheduleId: string, actorId: string, roleName: string, startTime: string, endTime: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO schedule_actors (id, schedule_id, actor_id, role_name, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
      id, scheduleId, actorId, roleName, startTime, endTime
    );
    return id;
  },
  deleteBySchedule: async (scheduleId: string) => {
    await db.run('DELETE FROM schedule_actors WHERE schedule_id = ?', scheduleId);
  },
  delete: async (id: string) => db.run('DELETE FROM schedule_actors WHERE id = ?', id)
};

// 签到记录数据库操作

export const ConflictChecker = {
  checkRoomConflict: async (roomId: string, startTime: string, endTime: string, excludeScheduleId?: string) => {
    let sql = `
      SELECT COUNT(*) as count FROM schedules
      WHERE room_id = ? AND status != 'cancelled'
      AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))
    `;
    const params: any[] = [roomId, endTime, startTime, endTime, startTime, startTime, endTime];
    if (excludeScheduleId) {
      sql += ' AND id != ?';
      params.push(excludeScheduleId);
    }
    const result = await db.get(sql, params);
    return (result?.count as number) > 0;
  },
  
  checkActorConflict: async (actorId: string, startTime: string, endTime: string, excludeScheduleId?: string) => {
    let sql = `
      SELECT COUNT(*) as count FROM schedule_actors sa
      JOIN schedules s ON sa.schedule_id = s.id
      WHERE sa.actor_id = ? AND s.status != 'cancelled'
      AND ((sa.start_time < ? AND sa.end_time > ?) OR (sa.start_time < ? AND sa.end_time > ?) OR (sa.start_time >= ? AND sa.end_time <= ?))
    `;
    const params: any[] = [actorId, endTime, startTime, endTime, startTime, startTime, endTime];
    if (excludeScheduleId) {
      sql += ' AND s.id != ?';
      params.push(excludeScheduleId);
    }
    const result = await db.get(sql, params);
    return (result?.count as number) > 0;
  },

  getActorAvailability: async (actorId: string, date: string) => {
    // 查 date 当天的占用情况（包含跨日排期）
    // 用 Date 对象计算 dayStart/nextDayStart（两者都是本地时间），转为 ISO 字符串后与 DB 中的 UTC ISO 字符串比较
    const dayStart = new Date(`${date}T00:00:00`);
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    return db.all(`
      SELECT sa.*, s.room_id, rooms.name as room_name, scripts.name as script_name
      FROM schedule_actors sa
      JOIN schedules s ON sa.schedule_id = s.id
      LEFT JOIN rooms ON s.room_id = rooms.id
      JOIN scripts ON s.script_id = scripts.id
      WHERE sa.actor_id = ?
        AND sa.end_time > ?
        AND sa.start_time < ?
        AND s.status != 'cancelled'
      ORDER BY sa.start_time
    `, actorId, dayStart.toISOString(), nextDayStart.toISOString());
  }
};
