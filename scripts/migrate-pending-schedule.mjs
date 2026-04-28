import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'scheduler.db');

console.log('数据库路径:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('数据库文件不存在，无需迁移');
  process.exit(0);
}

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

console.log('开始迁移...');

try {
  // 检查 room_id 是否已经是 nullable
  const tableInfo = await db.all("PRAGMA table_info(schedules)");
  const roomIdCol = tableInfo.find(c => c.name === 'room_id');
  
  console.log('当前 room_id 列信息:', roomIdCol);
  
  // 修改 room_id 为可空
  await db.exec(`
    ALTER TABLE schedules RENAME TO schedules_old;
    
    CREATE TABLE schedules (
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
    
    INSERT INTO schedules 
    SELECT id, room_id, script_id, start_time, end_time, 
           COALESCE(status, 'scheduled'), customer_name, customer_phone, player_count, note, created_at
    FROM schedules_old;
    
    DROP TABLE schedules_old;
  `);
  
  console.log('✓ 迁移完成：room_id 现在可为空，status 默认 pending');
  
} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
}

await db.close();
console.log('完成！');
