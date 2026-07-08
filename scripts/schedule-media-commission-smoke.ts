import assert from 'node:assert/strict';
import { tencentPgPool } from '../api/tencentPgSupabase';

const requiredColumns = [
  ['rooms', 'photo_url'],
  ['actors', 'photo_url'],
  ['schedules', 'customer_name'],
  ['schedules', 'customer_phone'],
  ['schedules', 'note'],
  ['schedules', 'store_car_sequence'],
];

const requiredTables = ['schedule_external_npcs', 'schedule_lingqi_commissions'];

async function main() {
  for (const [table, column] of requiredColumns) {
    const result = await tencentPgPool.query(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`,
      [table, column],
    );
    assert.equal(result.rowCount, 1, `${table}.${column} should exist`);
  }

  for (const table of requiredTables) {
    const result = await tencentPgPool.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
      [table],
    );
    assert.equal(result.rowCount, 1, `${table} should exist`);
  }

  console.log('schedule media commission schema smoke passed');
}

main()
  .finally(() => tencentPgPool.end())
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
