import { drizzle } from 'drizzle-orm/node-postgres';
import { tencentPgPool } from '../tencentPgSupabase.js';
import * as schema from './schema.js';

export const db = drizzle(tencentPgPool, { schema });
