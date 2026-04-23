import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, setCurrentUserId } from '../lib/supabase';
import { initCloudSync } from '../utils/cloud-storage';
import { setPlan, type Plan } from '../lib/plan';

async function syncPlanFromCloud(userId: string) {
  const { data } = await supabase.from('profiles').select('plan').eq('user_id', userId).single();
  if (data?.plan) {
    setPlan(data.plan as Plan);
  } else {
    // First time — seed the profile
    await supabase.from('profiles').upsert({ user_id: userId, plan: 'free' });
  }
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// Translate raw Supabase / Postgres error strings into something a human sees.
// Raw errors like "Database error saving new user" leak backend internals and
// give the user nothing to act on.
function friendlyAuthError(msg: string | undefined | null): string | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (m.includes('database error'))          return 'We couldn’t finish creating your account. Please try again in a moment — if the problem persists, contact support.';
  if (m.includes('invalid login'))           return 'That email and password don’t match. Double-check and try again, or reset your password.';
  if (m.includes('user already registered')) return 'An account with that email already exists. Try signing in instead.';
  if (m.includes('email not confirmed'))     return 'Please confirm your email — check your inbox for the verification link.';
  if (m.includes('password'))                return 'Password must be at least 8 characters.';
  if (m.includes('rate limit'))              return 'Too many attempts. Please wait a minute and try again.';
  return msg;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function seedLocalProfile(user: User) {
  try {
    const existing = JSON.parse(localStorage.getItem('sr-profile') ?? 'null');
    if (!existing?.displayName) {
      const username = user.user_metadata?.username ?? user.email?.split('@')[0] ?? '';
      localStorage.setItem('sr-profile', JSON.stringify({
        displayName: username,
        bio: existing?.bio ?? '',
        avatarColor: existing?.avatarColor ?? '#7c3aed',
      }));
    }
  } catch { /* ignore */ }
}

async function upsertCommunityProfile(user: User) {
  try {
    const local = JSON.parse(localStorage.getItem('sr-profile') ?? 'null');
    const displayName = local?.displayName || user.user_metadata?.username || user.email?.split('@')[0] || 'Anonymous Writer';
    const handle = '@' + (user.user_metadata?.username || user.email?.split('@')[0] || user.id.slice(0, 8)).toLowerCase().replace(/\s+/g, '');
    await supabase.from('community_profiles').upsert({
      user_id: user.id,
      display_name: displayName,
      handle,
      avatar_color: local?.avatarColor ?? '#7c3aed',
      bio: local?.bio ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id', ignoreDuplicates: false });
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run the one-time sync side-effects once per user id. Supabase fires
    // onAuthStateChange multiple times during normal operation (INITIAL_SESSION,
    // TOKEN_REFRESHED, SIGNED_IN, etc.); without this guard every event would
    // re-trigger a cloud sync / plan fetch / community upsert, causing the API
    // request storm we saw in the browser network tab.
    let syncedForUserId: string | null = null;
    function runUserSync(u: User) {
      if (syncedForUserId === u.id) return;
      syncedForUserId = u.id;
      initCloudSync(u.id);
      seedLocalProfile(u);
      syncPlanFromCloud(u.id);
      upsertCommunityProfile(u);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setCurrentUserId(session?.user?.id ?? null);
      if (session?.user) runUserSync(session.user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setCurrentUserId(session?.user?.id ?? null);
      if (!session?.user) {
        syncedForUserId = null;
        return;
      }
      runUserSync(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: friendlyAuthError(error?.message) };
  }

  async function sendPasswordResetEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?mode=reset`,
    });
    return { error: friendlyAuthError(error?.message) };
  }

  async function signUpWithEmail(email: string, password: string, username: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    return { error: friendlyAuthError(error?.message) };
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return { error: friendlyAuthError(error?.message) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordResetEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
