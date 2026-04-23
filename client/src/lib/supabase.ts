import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isConfigured = supabaseUrl?.startsWith('http');

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');

// Module-level user ID so storage utils can access it without React hooks
let _userId: string | null = null;

export function setCurrentUserId(id: string | null) {
  _userId = id;
}

export function getCurrentUserId(): string | null {
  return _userId;
}
