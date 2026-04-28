import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'scheduler.db');

async function migrate() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // 检查 role 字段是否已存在
    const columns = await db.all("PRAGMA table_info(checkins)");
    const hasRole = columns.some(col => col.name === 'role');
    
    if (hasRole) {
      console.log('✅ role 字段已存在，无需迁移');
    } else {
      await db.run('ALTER TABLE checkins ADD COLUMN role TEXT');
      console.log('✅ 成功添加 role 字段到 checkins 表');
    }
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  }

  await db.close();
}

migrate();
