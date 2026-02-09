import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase client for database/storage operations
// Auth is handled by Clerk, not Supabase
export const createClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
