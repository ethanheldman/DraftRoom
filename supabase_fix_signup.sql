-- ============================================================================
--  DraftRoom — signup trigger fix
--  ----------------------------------------------------------------------------
--  Problem: Sign-ups fail with "Database error saving new user".
--  Root cause: A SECURITY DEFINER trigger on auth.users (handle_new_user or
--  similar) is throwing during INSERT, which Supabase's GoTrue service reports
--  as a generic error. Common causes:
--    * Trigger references a column that no longer exists.
--    * Trigger inserts into a table without a NOT NULL default or with RLS that
--      blocks the SECURITY DEFINER role.
--    * Trigger function was dropped but the trigger itself wasn't.
--
--  This script:
--    1. Shows you any triggers currently firing on auth.users.
--    2. Replaces handle_new_user() with a defensive version that:
--         - seeds public.profiles (plan='free')
--         - seeds public.community_profiles (display_name, handle)
--         - NEVER throws — wraps each insert in EXCEPTION WHEN OTHERS.
--    3. Re-creates the trigger on auth.users.
--
--  Run this inside Supabase Dashboard → SQL Editor → New Query.
-- ============================================================================

-- 1. Inspect what's currently attached to auth.users (for your records).
SELECT tgname AS trigger_name,
       pg_get_triggerdef(oid) AS definition
  FROM pg_trigger
 WHERE tgrelid = 'auth.users'::regclass
   AND NOT tgisinternal;

-- 2. Drop the bad function/trigger (safe to run even if not present).
DROP TRIGGER IF EXISTS on_auth_user_created  ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user       ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Make sure the tables it needs actually exist (no-ops if they do).
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan                 text NOT NULL DEFAULT 'free',
  stripe_customer_id   text,
  stripe_subscription_id text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT 'Anonymous Writer',
  handle        text,
  avatar_color  text DEFAULT '#7c3aed',
  bio           text DEFAULT '',
  role          text DEFAULT 'Screenwriter',
  is_public     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 4. Defensive trigger function — never blocks signup.
--    Any insert that fails is swallowed and logged as a NOTICE so the user is
--    still created; the client can back-fill the profile row on first load.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_handle   text;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'writer'
  );
  v_handle := '@' || lower(regexp_replace(v_username, '\s+', '', 'g'));

  BEGIN
    INSERT INTO public.profiles (user_id, plan)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'handle_new_user: profiles insert failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.community_profiles (user_id, display_name, handle)
    VALUES (NEW.id, v_username, v_handle)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'handle_new_user: community_profiles insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 5. Re-attach the trigger.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Quick verification — list triggers on auth.users.
SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

-- 7. Sanity check: try a dry signup via the JS SDK in your client after running
--    this. You should see a row appear in BOTH public.profiles and
--    public.community_profiles. If either is missing, inspect the NOTICE log
--    in Supabase Dashboard → Logs → Postgres.
