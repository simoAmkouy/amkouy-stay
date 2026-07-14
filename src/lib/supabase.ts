import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { supabaseStorage } from '@/lib/supabase-storage';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your project values.'
  );
}

/**
 * Real Supabase Auth is wired up (see hooks/use-auth.tsx). Session persistence uses
 * `supabaseStorage`, which guards every `window` access so it's safe during Expo Router's
 * Node-side static web render — this is what previously required persistSession to stay off.
 * `detectSessionInUrl` is web-only: it's how the password-reset email link resolves into a
 * session on the `/reset-password` screen.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web' && typeof window !== 'undefined',
  },
});
