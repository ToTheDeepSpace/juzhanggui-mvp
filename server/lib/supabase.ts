import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!process.env.DEFAULT_TENANT_ID) throw new Error('Missing env: DEFAULT_TENANT_ID');
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID;
