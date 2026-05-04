import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');

export const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
