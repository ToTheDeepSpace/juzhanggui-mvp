import pkg from 'pg';
const { Client } = pkg;

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudHJ5YmJ0ZGtpZmdqZmpnbXV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1MzE2NSwiZXhwIjoyMDkyOTI5MTY1fQ.Wpu1L-jav4qytJErtCeV-NSd0b1Ko1eMKKjGrwVy6_4';

const configs = [
  { name: 'direct (password=key)', cs: `postgresql://postgres:${KEY}@db.sntrybbtdkifgjfjgmuw.supabase.co:5432/postgres` },
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
    console.log(`✅ ${config.name}: Tables created!`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`❌ ${config.name}: ${e.message.substring(0, 100)}`);
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
