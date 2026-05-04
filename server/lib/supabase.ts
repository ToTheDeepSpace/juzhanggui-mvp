import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://sntrybbtdkifgjfjgmuw.supabase.co';
// 服务端使用 service_role 密钥（绕过 RLS 限制）
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// 临时默认店铺 ID（后续从 JWT token 中解析）
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
