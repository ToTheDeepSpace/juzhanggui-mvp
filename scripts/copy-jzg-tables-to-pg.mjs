import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const DEFAULT_TABLES = [
  'jzg_stores',
  'jzg_admin_users',
  'jzg_email_verification_codes',
  'jzg_platform_audit_logs',
  'jzg_script_templates',
  'actors',
  'rooms',
  'scripts',
  'script_player_roles',
  'script_actor_roles',
  'script_roles',
  'actor_skills',
  'schedules',
  'schedule_actors',
  'players',
  'checkins',
  'jzg_carpool_join_requests',
  'evaluations',
  'customers',
  'notifications',
  'conflict_records',
  'lc_auth_verification_codes',
  'lc_profiles',
  'lc_carpools',
  'jzg_dm_leave_requests',
  'jzg_dm_experience_notes',
];

function parseEnv(file) {
  const out = {};
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`bad ident ${name}`);
  return `"${name}"`;
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => {
      if (typeof item !== 'string') return item;
      try { return JSON.parse(item); } catch { return item; }
    }));
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

const supabaseEnv = parseEnv(process.env.SUPABASE_ENV_FILE || '/srv/jusichen/LingQi/.env.local');
const pgEnv = parseEnv(process.env.PG_ENV_FILE || '/srv/secrets/jusichen_postgres_app.env');
const supabaseUrl = supabaseEnv.SUPABASE_URL || supabaseEnv.VITE_SUPABASE_URL;
const serviceKey = supabaseEnv.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL || pgEnv.DATABASE_URL;

if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');
if (!databaseUrl) throw new Error('Missing DATABASE_URL');

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = new pg.Client({ connectionString: databaseUrl });
const tables = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TABLES;

await client.connect();
try {
  const payloads = [];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);

    const colsRes = await client.query(
      "select column_name, udt_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
      [table],
    );
    const cols = colsRes.rows.map((row) => row.column_name);
    const typeByColumn = Object.fromEntries(colsRes.rows.map((row) => [row.column_name, row.udt_name]));
    if (!cols.length) throw new Error(`${table}: target table does not exist`);
    payloads.push({ table, data: data || [], cols, typeByColumn });
  }

  await client.query('begin');
  await client.query(`truncate table ${payloads.map(({ table }) => `public.${quoteIdent(table)}`).join(', ')} restart identity cascade`);
  for (const { table, data, cols, typeByColumn } of payloads) {
    for (const row of data || []) {
      const names = cols.filter((col) => row[col] !== undefined);
      if (!names.length) continue;
      const values = names.map((col) => (
        typeByColumn[col] === 'json' || typeByColumn[col] === 'jsonb'
          ? normalizeJsonValue(row[col])
          : row[col]
      ));
      const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `insert into public.${quoteIdent(table)} (${names.map(quoteIdent).join(', ')}) values (${placeholders})`,
        values,
      );
    }
    console.log(`${table}: copied ${(data || []).length}`);
  }
  await client.query('commit');
} catch (error) {
  try { await client.query('rollback'); } catch {}
  throw error;
} finally {
  await client.end();
}
