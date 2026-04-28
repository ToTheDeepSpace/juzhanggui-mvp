import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://sntrybbtdkifgjfjgmuw.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudHJ5YmJ0ZGtpZmdqZmpnbXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTMxNjUsImV4cCI6MjA5MjkyOTE2NX0.uwhCV5_9EmQqYJCYxVeS1Rtnmoaxvs58DgLdRfFH8EU';

export const supabase = createClient(supabaseUrl, supabaseKey);
