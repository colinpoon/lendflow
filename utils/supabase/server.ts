import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client for database/storage operations
// Auth is handled by Clerk, not Supabase
export const createClient = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    console.error('Missing Supabase credentials:', { url: !!url, key: !!key });
    throw new Error('Missing Supabase credentials');
  }

  return createSupabaseClient(url, key);
};
