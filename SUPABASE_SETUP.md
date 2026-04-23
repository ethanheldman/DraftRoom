# Supabase Setup

## Step 1 — Create a Supabase project
Go to https://supabase.com, create a new project, and copy your **Project URL** and **Anon Key** from Settings → API.

## Step 2 — Add env vars
Open `client/.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3 — Run this SQL in Supabase SQL Editor
Go to your Supabase dashboard → SQL Editor → New Query, paste and run:

```sql
-- Projects table
create table if not exists projects (
  id text primary key,
  user_id uuid references auth.users not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table projects enable row level security;
create policy "Users own their projects" on projects
  for all using (auth.uid() = user_id);

-- Scripts table
create table if not exists scripts (
  project_id text primary key references projects(id) on delete cascade,
  user_id uuid references auth.users not null,
  nodes jsonb not null,
  updated_at timestamptz default now()
);
alter table scripts enable row level security;
create policy "Users own their scripts" on scripts
  for all using (auth.uid() = user_id);

-- Community profiles (public — visible to all logged-in users)
create table if not exists community_profiles (
  user_id uuid primary key references auth.users,
  display_name text not null default 'Anonymous Writer',
  handle text,
  avatar_color text default '#7c3aed',
  bio text default '',
  role text default 'Screenwriter',
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table community_profiles enable row level security;
create policy "Public profiles readable by authenticated users" on community_profiles
  for select using (auth.role() = 'authenticated' and is_public = true);
create policy "Users manage own community profile" on community_profiles
  for all using (auth.uid() = user_id);

-- Profiles table (stores subscription plan — source of truth)
create table if not exists profiles (
  user_id uuid primary key references auth.users,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = user_id);
-- Note: updates to plan are done server-side via service role key (Stripe webhook)

-- TV Shows table
create table if not exists tv_shows (
  id text primary key,
  user_id uuid references auth.users not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table tv_shows enable row level security;
create policy "Users own their shows" on tv_shows
  for all using (auth.uid() = user_id);

-- Notifications table (squad activity, nudges, messages, shares)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  sender_id uuid references auth.users not null,
  sender_name text not null default '',
  sender_color text not null default '#7c3aed',
  type text not null check (type in ('squad_add', 'nudge', 'message', 'share')),
  message text not null default '',
  metadata jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
-- Users can read their own notifications
create policy "Users read their notifications" on notifications
  for select using (auth.uid() = user_id);
-- Anyone signed in can insert a notification for another user
create policy "Users can send notifications" on notifications
  for insert with check (auth.uid() = sender_id);
-- Users can update (mark read) their own notifications
create policy "Users can mark read" on notifications
  for update using (auth.uid() = user_id);
-- Senders can read their own sent messages (needed for DM thread history)
create policy "Senders can read sent messages" on notifications
  for select using (auth.uid() = sender_id);

-- Squad members table (bidirectional squad relationships)
create table if not exists squad_members (
  user_id uuid references auth.users not null,
  member_user_id uuid references auth.users not null,
  member_data jsonb not null default '{}',
  created_at timestamptz default now(),
  primary key (user_id, member_user_id)
);
alter table squad_members enable row level security;
create policy "Users own their squad" on squad_members
  for all using (auth.uid() = user_id);

-- Enable real-time for notifications
alter publication supabase_realtime add table notifications;

-- Shared scripts (stores actual script content when a user shares with a squad member)
create table if not exists shared_scripts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users not null,
  recipient_id uuid references auth.users not null,
  title text not null default 'Untitled',
  sender_name text not null default '',
  script_nodes jsonb not null default '[]',
  created_at timestamptz default now()
);
alter table shared_scripts enable row level security;
create policy "Senders can insert shared scripts" on shared_scripts
  for insert with check (auth.uid() = sender_id);
create policy "Recipients and senders can view shared scripts" on shared_scripts
  for select using (auth.uid() = recipient_id or auth.uid() = sender_id);

-- Allow senders to read their own sent notifications (needed for DM thread history)
create policy "Senders can read sent messages" on notifications
  for select using (auth.uid() = sender_id);
```

## Step 4 — Add Stripe env vars to server
Open `.env` (root level, used by the server) and fill in:
```
STRIPE_SECRET_KEY=sk_test_...         # from https://dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...       # from Stripe webhook settings (see Step 6)
SUPABASE_SERVICE_ROLE_KEY=...         # from Supabase → Settings → API → service_role key
```

## Step 5 — Enable Google OAuth (optional)
In Supabase dashboard → Authentication → Providers → Google:
1. Enable Google provider
2. Add your Google OAuth credentials (from Google Cloud Console)
3. Add `http://localhost:5173` to allowed redirect URLs

## Step 6 — Set up Stripe webhook (for local dev)
Install the Stripe CLI: https://stripe.com/docs/stripe-cli

Then run:
```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```
Copy the `whsec_...` secret it prints and put it in `.env` as `STRIPE_WEBHOOK_SECRET`.

For production, add the webhook URL in Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://your-domain.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`

## Step 7 — Run the app
```bash
cd client && npm run dev
```

Sign up with a new account — your existing localStorage projects will automatically migrate to the cloud on first sign-in.
