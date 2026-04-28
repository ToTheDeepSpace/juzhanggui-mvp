import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb() {
  // 确保数据目录存在（在项目根目录的data文件夹中）
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbDir = path.join(__dirname, '..', '..', 'data');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = await open({
    filename: path.join(dbDir, 'scheduler.db'),
    driver: sqlite3.Database,
  });

  await db.exec(`
    -- 房间表
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 卡司表
    CREATE TABLE IF NOT EXISTS actors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 剧本表
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      dm_gender TEXT DEFAULT '未指定',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 剧本玩家角色表
    CREATE TABLE IF NOT EXISTS script_player_roles (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    -- 剧本卡司角色表
    CREATE TABLE IF NOT EXISTS script_actor_roles (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    -- 卡司技能表
    CREATE TABLE IF NOT EXISTS actor_skills (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      script_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      role_type TEXT DEFAULT 'actor',
      proficiency INTEGER DEFAULT 1,
      FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
      UNIQUE(actor_id, script_id, role_name)
    );

    -- 剧本角色配置表
    CREATE TABLE IF NOT EXISTS script_roles (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      required_duration INTEGER,
      start_offset INTEGER DEFAULT 0,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    -- 排期表
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      room_id TEXT,
      script_id TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      customer_name TEXT,
      customer_phone TEXT,
      player_count INTEGER,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    -- 排期卡司分配表
    CREATE TABLE IF NOT EXISTS schedule_actors (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
    );

    -- 签到记录表
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      guest_avatar TEXT,
      role TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );

    -- 评价记录表
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );
  `);

  // 迁移函数（幂等调用，只执行一次）
  async function runMigrations() {
    // 1. 获取当前 evaluations 表的列信息
    const cols = await db.all("PRAGMA table_info(evaluations)");
    const colNames = new Set(cols.map((c: any) => c.name));

    // 2. 补 guest_name 列（SQLite >= 3.35 支持 ADD COLUMN）
    if (!colNames.has('guest_name')) {
      await db.exec("ALTER TABLE evaluations ADD COLUMN guest_name TEXT NOT NULL DEFAULT ''");
    }
    // 4. 添加剧本时长双字段和角色性别字段
    const scriptCols = await db.all("PRAGMA table_info(scripts)");
    const scriptColNames = new Set(scriptCols.map((c: any) => c.name));
    if (!scriptColNames.has('min_duration')) {
        await db.exec("ALTER TABLE scripts ADD COLUMN min_duration INTEGER DEFAULT 0");
    }
    if (!scriptColNames.has('max_duration')) {
        await db.exec("ALTER TABLE scripts ADD COLUMN max_duration INTEGER DEFAULT 0");
    }
    // 将现有 duration 迁移到 min_duration 和 max_duration
    if (!scriptColNames.has('min_duration') || !scriptColNames.has('max_duration')) {
        await db.exec("UPDATE scripts SET min_duration = duration, max_duration = duration WHERE min_duration = 0 AND max_duration = 0");
    }
    
    const playerRoleCols = await db.all("PRAGMA table_info(script_player_roles)");
    const playerRoleColNames = new Set(playerRoleCols.map((c: any) => c.name));
    if (!playerRoleColNames.has('gender')) {
        await db.exec("ALTER TABLE script_player_roles ADD COLUMN gender TEXT DEFAULT ''");
    }
    
    const actorRoleCols = await db.all("PRAGMA table_info(script_actor_roles)");
    const actorRoleColNames = new Set(actorRoleCols.map((c: any) => c.name));
    if (!actorRoleColNames.has('gender')) {
        await db.exec("ALTER TABLE script_actor_roles ADD COLUMN gender TEXT DEFAULT ''");
    }
    
    const scriptRoleCols = await db.all("PRAGMA table_info(script_roles)");
    const scriptRoleColNames = new Set(scriptRoleCols.map((c: any) => c.name));
    if (!scriptRoleColNames.has('gender')) {
        await db.exec("ALTER TABLE script_roles ADD COLUMN gender TEXT DEFAULT ''");
    }


    // 3. 重建表添加 UNIQUE(schedule_id, guest_name)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _evaluations_new (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        guest_name TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(schedule_id, guest_name)
      );
      INSERT OR IGNORE INTO _evaluations_new (id, schedule_id, guest_name, rating, comment, created_at)
        SELECT id, schedule_id, '' AS guest_name, rating, comment, created_at FROM evaluations;
      DROP TABLE evaluations;
      ALTER TABLE _evaluations_new RENAME TO evaluations;
    `);
  }

  await runMigrations();
  // 创建客户表（会员管理）
  await db.exec(`
    -- 客户/会员表
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      avatar TEXT,
      membership_level TEXT NOT NULL DEFAULT 'none', -- 'none', 'bronze', 'silver', 'gold'
      balance INTEGER DEFAULT 0, -- 余额（分）
      total_recharged INTEGER DEFAULT 0, -- 累计充值（分）
      total_consumed INTEGER DEFAULT 0, -- 累计消费（分）
      last_visit_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 会员交易记录表
    CREATE TABLE IF NOT EXISTS membership_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      schedule_id TEXT, -- 关联排期（消费时记录）
      amount INTEGER NOT NULL, -- 正数表示充值，负数表示消费
      transaction_type TEXT NOT NULL, -- 'recharge', 'consume', 'refund'
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
    );

    -- 客户偏好表（记录客户喜欢的卡司）
    CREATE TABLE IF NOT EXISTS customer_preferences (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      actor_id TEXT NOT NULL, -- 喜欢的卡司
      preference_level INTEGER DEFAULT 1, -- 偏好程度 1-5
      notes TEXT, -- 备注，如“特别喜欢他演的XX角色”
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, actor_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
    );

    -- 矛盾记录表（记录客户与卡司的矛盾及解决方案）
    CREATE TABLE IF NOT EXISTS conflict_records (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL, -- 关联的排期
      customer_id TEXT NOT NULL, -- 客户
      actor_id TEXT NOT NULL, -- 卡司
      conflict_type TEXT NOT NULL, -- 矛盾类型：'service_attitude', 'performance', 'communication', 'other'
      conflict_description TEXT NOT NULL, -- 矛盾描述
      conflict_date DATETIME NOT NULL, -- 发生日期
      resolution TEXT, -- 解决方案
      resolved_by TEXT, -- 解决人
      resolved_at DATETIME, -- 解决时间
      status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'escalated'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
    );

    -- 提醒表（用于剧本开始和到期提醒）
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      reminder_type TEXT NOT NULL, -- 'start'（开始前提醒）, 'end'（结束后提醒）, 'payment'（付款提醒）
      trigger_time DATETIME NOT NULL, -- 触发时间
      status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );

    -- 站内通知表
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      schedule_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
    );
  `);
  return db;
}

export function getDb() {
  return db;
}

// 数据库操作接口