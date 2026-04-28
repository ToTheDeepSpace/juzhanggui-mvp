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

export const CustomerDB = {
  getAll: async () => db.all('SELECT * FROM customers ORDER BY name'),
  getById: async (id: string) => db.get('SELECT * FROM customers WHERE id = ?', id),
  getByPhone: async (phone: string) => db.get('SELECT * FROM customers WHERE phone = ?', phone),
  search: async (query: string) => {
    const q = `%${query}%`;
    return db.all('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 20', q, q);
  },
  create: async (data: {
    name: string;
    phone?: string;
    avatar?: string;
    membershipLevel?: string;
    balance?: number;
  }) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO customers (id, name, phone, avatar, membership_level, balance) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      data.name,
      data.phone || null,
      data.avatar || null,
      data.membershipLevel || 'none',
      data.balance || 0
    );
    return id;
  },
  update: async (id: string, data: {
    name?: string;
    phone?: string;
    avatar?: string;
    membershipLevel?: string;
    balance?: number;
    lastVisitAt?: string;
  }) => {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(data.phone || null); }
    if (data.avatar !== undefined) { updates.push('avatar = ?'); params.push(data.avatar || null); }
    if (data.membershipLevel !== undefined) { updates.push('membership_level = ?'); params.push(data.membershipLevel); }
    if (data.balance !== undefined) { updates.push('balance = ?'); params.push(data.balance); }
    if (data.lastVisitAt !== undefined) { updates.push('last_visit_at = ?'); params.push(data.lastVisitAt); }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      await db.run(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, ...params);
    }
  },
  delete: async (id: string) => db.run('DELETE FROM customers WHERE id = ?', id),
  
  // 交易记录
      addTransaction: async (customerId: string, amount: number, transactionType: string, note?: string, scheduleId?: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO membership_transactions (id, customer_id, amount, transaction_type, note, schedule_id) VALUES (?, ?, ?, ?, ?, ?)',
      id, customerId, amount, transactionType, note || null, scheduleId || null
    );
    // 更新客户余额和统计
    if (transactionType === 'recharge') {
      // 充值：增加余额和累计充值
      await db.run('UPDATE customers SET balance = balance + ?, total_recharged = total_recharged + ? WHERE id = ?', amount, amount, customerId);
    } else if (transactionType === 'consume') {
      // 消费：减少余额，增加累计消费（amount为正数）
      await db.run('UPDATE customers SET balance = balance - ?, total_consumed = total_consumed + ? WHERE id = ?', amount, amount, customerId);
    } else if (transactionType === 'refund') {
      // 退款：增加余额，减少累计消费（amount为正数）
      await db.run('UPDATE customers SET balance = balance + ?, total_consumed = total_consumed - ? WHERE id = ?', amount, amount, customerId);
    }
    return id;
  },
  getTransactions: async (customerId: string, limit = 50) => {
    return db.all(
      `SELECT mt.*, 
              s.start_time as schedule_start,
              s.end_time as schedule_end,
              sc.name as script_name
       FROM membership_transactions mt
       LEFT JOIN schedules s ON mt.schedule_id = s.id
       LEFT JOIN scripts sc ON s.script_id = sc.id
       WHERE mt.customer_id = ? 
       ORDER BY mt.created_at DESC 
       LIMIT ?`,
      customerId, limit
    );
  },
};


export const CustomerPreferenceDB = {
  // 添加客户偏好
  create: async (customerId: string, actorId: string, preferenceLevel = 1, notes?: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO customer_preferences (id, customer_id, actor_id, preference_level, notes) VALUES (?, ?, ?, ?, ?)',
      id, customerId, actorId, preferenceLevel, notes || null
    );
    return id;
  },

  // 更新客户偏好
  update: async (id: string, preferenceLevel?: number, notes?: string) => {
    const updates = [];
    const params = [];
    if (preferenceLevel !== undefined) {
      updates.push('preference_level = ?');
      params.push(preferenceLevel);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (updates.length === 0) {
      return;
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    await db.run(
      `UPDATE customer_preferences SET ${updates.join(', ')} WHERE id = ?`,
      ...params
    );
  },

  // 获取客户的偏好列表
  getByCustomer: async (customerId: string) => {
    return db.all(
      `SELECT cp.*, a.name as actor_name, a.avatar as actor_avatar
       FROM customer_preferences cp
       JOIN actors a ON cp.actor_id = a.id
       WHERE cp.customer_id = ?
       ORDER BY cp.preference_level DESC`,
      customerId
    );
  },

  // 删除偏好
  delete: async (id: string) => {
    await db.run('DELETE FROM customer_preferences WHERE id = ?', id);
  },

  // 检查是否已存在
  exists: async (customerId: string, actorId: string) => {
    const result = await db.get(
      'SELECT id FROM customer_preferences WHERE customer_id = ? AND actor_id = ?',
      customerId, actorId
    );
    return !!result;
  },
};


export const ConflictRecordDB = {
  // 创建矛盾记录
  create: async (data: {
    scheduleId: string;
    customerId: string;
    actorId: string;
    conflictType: string;
    conflictDescription: string;
    conflictDate: string;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    status?: string;
  }) => {
    const id = uuidv4();
    await db.run(
      `INSERT INTO conflict_records 
       (id, schedule_id, customer_id, actor_id, conflict_type, conflict_description, conflict_date, 
        resolution, resolved_by, resolved_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, data.scheduleId, data.customerId, data.actorId, data.conflictType,
      data.conflictDescription, data.conflictDate, data.resolution || null,
      data.resolvedBy || null, data.resolvedAt || null, data.status || 'pending'
    );
    return id;
  },

  // 更新矛盾记录
  update: async (id: string, data: {
    conflictType?: string;
    conflictDescription?: string;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    status?: string;
  }) => {
    const updates = [];
    const params = [];
    if (data.conflictType !== undefined) {
      updates.push('conflict_type = ?');
      params.push(data.conflictType);
    }
    if (data.conflictDescription !== undefined) {
      updates.push('conflict_description = ?');
      params.push(data.conflictDescription);
    }
    if (data.resolution !== undefined) {
      updates.push('resolution = ?');
      params.push(data.resolution);
    }
    if (data.resolvedBy !== undefined) {
      updates.push('resolved_by = ?');
      params.push(data.resolvedBy);
    }
    if (data.resolvedAt !== undefined) {
      updates.push('resolved_at = ?');
      params.push(data.resolvedAt);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (updates.length === 0) {
      return;
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    await db.run(
      `UPDATE conflict_records SET ${updates.join(', ')} WHERE id = ?`,
      ...params
    );
  },

  // 获取排期的矛盾记录
  getBySchedule: async (scheduleId: string) => {
    return db.all(
      `SELECT cr.*, c.name as customer_name, a.name as actor_name, s.start_time, s.end_time, sc.name as script_name
       FROM conflict_records cr
       JOIN customers c ON cr.customer_id = c.id
       JOIN actors a ON cr.actor_id = a.id
       JOIN schedules s ON cr.schedule_id = s.id
       JOIN scripts sc ON s.script_id = sc.id
       WHERE cr.schedule_id = ?
       ORDER BY cr.conflict_date DESC`,
      scheduleId
    );
  },

  // 获取客户的矛盾记录
  getByCustomer: async (customerId: string, limit = 20) => {
    return db.all(
      `SELECT cr.*, a.name as actor_name, s.start_time, sc.name as script_name
       FROM conflict_records cr
       JOIN actors a ON cr.actor_id = a.id
       JOIN schedules s ON cr.schedule_id = s.id
       JOIN scripts sc ON s.script_id = sc.id
       WHERE cr.customer_id = ?
       ORDER BY cr.conflict_date DESC
       LIMIT ?`,
      customerId, limit
    );
  },

  // 获取未解决的矛盾记录
  getPending: async () => {
    return db.all(
      `SELECT cr.*, c.name as customer_name, a.name as actor_name, sc.name as script_name, s.start_time
       FROM conflict_records cr
       JOIN customers c ON cr.customer_id = c.id
       JOIN actors a ON cr.actor_id = a.id
       JOIN schedules s ON cr.schedule_id = s.id
       JOIN scripts sc ON s.script_id = sc.id
       WHERE cr.status = 'pending'
       ORDER BY cr.conflict_date`
    );
  },

  // 删除矛盾记录
  delete: async (id: string) => {
    await db.run('DELETE FROM conflict_records WHERE id = ?', id);
  },
};


export const ReminderDB = {
  // 创建提醒
  create: async (scheduleId: string, reminderType: string, triggerTime: string) => {
    const id = uuidv4();
    await db.run(
      'INSERT INTO reminders (id, schedule_id, reminder_type, trigger_time) VALUES (?, ?, ?, ?)',
      id, scheduleId, reminderType, triggerTime
    );
    return id;
  },

  // 标记提醒为已发送
  markSent: async (id: string) => {
    await db.run(
      'UPDATE reminders SET status = \'sent\', sent_at = CURRENT_TIMESTAMP WHERE id = ?',
      id
    );
  },

  // 获取待处理的提醒
  getPending: async (before?: string) => {
    let sql = 'SELECT * FROM reminders WHERE status = \'pending\'';
    const params = [];
    if (before) {
      sql += ' AND trigger_time <= ?';
      params.push(before);
    }
    sql += ' ORDER BY trigger_time';
    return db.all(sql, ...params);
  },

  // 获取排期的提醒
  getBySchedule: async (scheduleId: string) => {
    return db.all(
      'SELECT * FROM reminders WHERE schedule_id = ? ORDER BY trigger_time',
      scheduleId
    );
  },

  // 删除提醒
  delete: async (id: string) => {
    await db.run('DELETE FROM reminders WHERE id = ?', id);
  },
};

