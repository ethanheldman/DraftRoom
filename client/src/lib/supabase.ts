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

/**
 * Which external auth providers are actually enabled in this Supabase project.
 *
 * Why we need this client-side: Supabase silently accepts a `signInWithOAuth`
 * call for a disabled provider — `signInWithOAuth({ provider: 'google' })`
 * resolves without error and just doesn't redirect. From the user's
 * perspective the "Continue with Google" button looks broken. Fetching the
 * public /auth/v1/settings endpoint up front lets us hide buttons for
 * providers the project hasn't configured yet.
 *
 * Cached for the lifetime of the page; the underlying setting changes only
 * when an admin flips a switch in the Supabase dashboard.
 */
export interface AuthProviderFlags {
  google: boolean;
  github: boolean;
  email: boolean;
  apple: boolean;
}

let _providerFlagsCache: Promise<AuthProviderFlags> | null = null;

export function getEnabledAuthProviders(): Promise<AuthProviderFlags> {
  if (_providerFlagsCache) return _providerFlagsCache;
  if (!isConfigured) {
    _providerFlagsCache = Promise.resolve({ google: false, github: false, email: true, apple: false });
    return _providerFlagsCache;
  }
  _providerFlagsCache = fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseAnonKey },
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(j => ({
      google: !!j?.external?.google,
      github: !!j?.external?.github,
      email:  !!j?.external?.email,
      apple:  !!j?.external?.apple,
    }))
    .catch(() => ({ google: false, github: false, email: true, apple: false }));
  return _providerFlagsCache;
}
