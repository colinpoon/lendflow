'use client';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/nextjs';
import { useMemo } from 'react';

// Authenticated client hook - respects RLS via Clerk JWT
export const useSupabaseClient = () => {
  const { getToken } = useAuth();

  return useMemo(() => {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: async (url, options: RequestInit = {}) => {
            const token = await getToken({ template: 'supabase' });
            const headers = new Headers(options.headers);
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
            }
            return fetch(url, { ...options, headers });
          },
        },
      }
    );
  }, [getToken]);
};

// Legacy export (no auth) - for cases where auth is not available
export const createClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
