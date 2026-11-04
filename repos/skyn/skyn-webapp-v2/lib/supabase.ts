import { createBrowserClient } from '@supabase/ssr';
import { isPlaceholder } from './env';

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !isPlaceholder(url) && !isPlaceholder(key);
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';
  return createBrowserClient(url, key);
}
