import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const tables = [
  `CREATE TABLE IF NOT EXISTS lc_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar TEXT, bio TEXT,
    tags JSONB DEFAULT '[]'::jsonb, city TEXT,
    role_type TEXT NOT NULL DEFAULT 'creator',
    social_links JSONB DEFAULT '{}'::jsonb,
    wechat TEXT, is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lc_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0,
    duration TEXT, description TEXT, is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lc_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
    is_booked BOOLEAN DEFAULT false, note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lc_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, caption TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`
];

async function main() {
  for (const sql of tables) {
    console.log('Executing:', sql.substring(0, 60) + '...');
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
      if (error) console.log('  -> ERROR:', error.message);
      else console.log('  -> OK');
    } catch (e) {
      console.log('  -> FAILED:', e.message);
    }
  }
  console.log('\nDone. If all failed, create a Postgres function first.');
  console.log('Go to Supabase SQL Editor and run:');
  console.log(`
CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
}

main();
