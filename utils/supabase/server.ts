import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Authenticated client - respects RLS via Clerk JWT
export const createClient = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const { getToken } = await auth();
  const supabaseToken = await getToken({ template: 'supabase' });

  if (!supabaseToken) {
    // Return unauthenticated client (RLS will restrict access)
    return createSupabaseClient(url, anonKey);
  }

  return createSupabaseClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
      },
    },
  });
};

// Admin client - bypasses RLS (use sparingly for admin operations)
export const createAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};
