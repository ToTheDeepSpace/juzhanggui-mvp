// LingQi bootstrap helper. Usage: SUPABASE_DB_URL=postgresql://... node scripts/setup-lc-tables.mjs

import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL');
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS lc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  city TEXT,
  role_type TEXT NOT NULL DEFAULT 'creator',
  social_links JSONB DEFAULT '{}'::jsonb,
  wechat TEXT,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

try {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');
  await client.query(sql);
  console.log('OK all lc_ tables created successfully');
  await client.end();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
