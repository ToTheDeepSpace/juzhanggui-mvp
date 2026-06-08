import pkg from 'pg';
const { Client } = pkg;

const KEY = process.env.SUPABASE_DB_PASSWORD;
if (!KEY) {
  throw new Error('Missing SUPABASE_DB_PASSWORD');
}

const configs = [
  { name: 'direct', cs: `postgresql://postgres:${KEY}@db.sntrybbtdkifgjfjgmuw.supabase.co:5432/postgres` },
  { name: 'pooler session', cs: `postgresql://postgres.sntrybbtdkifgjfjgmuw:${KEY}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` },
  { name: 'pooler transaction', cs: `postgresql://postgres.sntrybbtdkifgjfjgmuw:${KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` },
];

const SQL = `
CREATE TABLE IF NOT EXISTS lc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  avatar TEXT, bio TEXT, tags JSONB DEFAULT '[]'::jsonb,
  city TEXT, role_type TEXT NOT NULL DEFAULT 'creator',
  social_links JSONB DEFAULT '{}'::jsonb,
  wechat TEXT, is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lc_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration TEXT, description TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lc_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT false, note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lc_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL, caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

async function tryConnect(config) {
  try {
    const client = new Client({ connectionString: config.cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await client.connect();
    await client.query(SQL);
    console.log(`OK ${config.name}: tables created`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`FAIL ${config.name}: ${e.message.substring(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log('Trying to connect to Supabase PostgreSQL...\n');
  for (const cfg of configs) {
    if (await tryConnect(cfg)) return;
  }
  console.log('\nAll connection methods failed.');
  console.log('Please run the SQL manually in Supabase Dashboard SQL Editor.');
}

main();
