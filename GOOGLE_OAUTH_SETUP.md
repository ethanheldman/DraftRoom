# Enabling "Continue with Google"

The button is hidden in production right now because the Supabase project
has `external.google = false`. Confirmed via:

```bash
curl -s "https://paomcjxscbyorbwvhyzd.supabase.co/auth/v1/settings" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" | jq .external.google
# false
```

The client now auto-detects this — once you flip the switch below, the
button reappears on next page load with no code change.

## Step 1 — Create Google OAuth credentials

1. Open <https://console.cloud.google.com/apis/credentials>
2. **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `DraftRoom`
   - Authorized JavaScript origins:
     - `https://draft-room-wine.vercel.app`
     - `https://your-custom-domain.com` *(if any)*
     - `http://localhost:5173` *(local dev)*
   - Authorized redirect URIs:
     - `https://paomcjxscbyorbwvhyzd.supabase.co/auth/v1/callback`
3. **Create** → copy the Client ID and Client Secret.

If this is a brand-new GCP project you'll be prompted to configure the
**OAuth consent screen** first:
- User type: External
- App name: DraftRoom
- Support email: yours
- Authorized domains: `vercel.app`, your custom domain
- Scopes: leave the defaults (`email`, `profile`, `openid`)
- Test users: add yourself while the app is in "Testing" status

## Step 2 — Enable Google in Supabase

1. Open your project's **Auth** settings:
   <https://supabase.com/dashboard/project/paomcjxscbyorbwvhyzd/auth/providers>
2. Find **Google** in the providers list → toggle **Enabled**.
3. Paste the Client ID and Client Secret from Step 1.
4. **Save**.

## Step 3 — Whitelist your redirect URLs

Still on the Auth Settings page:

- **Site URL** → `https://draft-room-wine.vercel.app`
- **Redirect URLs** (additional allowed) — add:
  - `https://draft-room-wine.vercel.app/dashboard`
  - `https://draft-room-wine.vercel.app/**`
  - `http://localhost:5173/**` *(dev)*

The client passes `redirectTo: window.location.origin + '/dashboard'`,
so anything outside this whitelist will be rejected by Supabase.

## Step 4 — Verify

After ~30 seconds the public settings endpoint will reflect the change:

```bash
curl -s "https://paomcjxscbyorbwvhyzd.supabase.co/auth/v1/settings" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" | jq .external.google
# true
```

Reload the production sign-in page → the Google button is back.
No client redeploy needed.

## Common gotchas

- **"redirect_uri_mismatch"** — the URI you put in Google Cloud must match
  *exactly* including trailing slash. Supabase always uses
  `https://<project>.supabase.co/auth/v1/callback`.
- **App still in Testing** — Google blocks non-test-user emails until you
  publish the consent screen.
- **Cookies blocked** — third-party cookie restrictions can break the
  callback. The Supabase docs cover the workaround.
