import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'scheduler.db');
console.log('数据库路径:', dbPath);

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

console.log('\n=== schedules 表结构 ===');
const scheduleInfo = await db.all("PRAGMA table_info(schedules)");
console.log(scheduleInfo.map(c => `${c.name} (${c.type})`).join('\n'));

console.log('\n=== schedules 表数据 ===');
const schedules = await db.all("SELECT * FROM schedules");
console.log(JSON.stringify(schedules, null, 2));

console.log('\n=== checkins 表数据 ===');
const checkins = await db.all("SELECT * FROM checkins");
console.log(JSON.stringify(checkins, null, 2));

console.log('\n=== scripts 表结构 ===');
const scriptInfo = await db.all("PRAGMA table_info(scripts)");
console.log(scriptInfo.map(c => `${c.name} (${c.type})`).join('\n'));

console.log('\n=== scripts 表数据 ===');
const scripts = await db.all("SELECT * FROM scripts");
console.log(JSON.stringify(scripts, null, 2));

await db.close();
console.log('\n完成!');
