# DraftRoom

A screenwriting app that gets out of your way. Fountain-style editor, AI Script
Doctor, beat sheet, breakdown, schedule, cast & crew, version history, and
real-time stats — all in one tool.

![](https://img.shields.io/badge/status-alpha-orange) ![](https://img.shields.io/badge/stack-vite%20%2B%20react%20%2B%20supabase-blueviolet)

## Stack

- **Frontend** — Vite + React 19 + TypeScript + Tailwind, `client/`
- **Backend** — Express (Stripe webhooks, AI proxy), `server/`
- **Auth & DB** — Supabase (GoTrue + Postgres + RLS)
- **Payments** — Stripe (Starter / Pro / Studio tiers)

## Quick start

```bash
# Install
cd client  && npm install
cd ../server && npm install

# Env
cp client/.env.example client/.env        # fill in Supabase URL + anon key
cp .env.example .env                      # Stripe + Supabase service role (root)

# Run
cd client  && npm run dev     # http://localhost:5173
cd server  && npm run dev     # http://localhost:3001
```

See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for one-time DB setup
(tables, RLS policies, `handle_new_user` trigger).

## Project layout

```
screenwriter/
├── client/          # Vite React app  (UI, editor, Supabase client)
├── server/          # Express API    (Stripe webhooks, AI endpoints)
├── supabase_fix_signup.sql
└── SUPABASE_SETUP.md
```

## Key features

- **Fountain-style editor** with Tab-cycle element types, `⌘0`–`⌘8` shortcuts
- **Autosave + autosnapshot** every 2s / every 5min
- **(CONT'D) / (MORE)** injected on export (FDX, Fountain, Plain text)
- **Script Doctor AI** — streaming edits with diff/accept UI, never auto-applies
- **Beat Sheet** with act-mismatch warnings and dynamic page-to-act logic
- **Schedule** with DAY/NIGHT inference from clock times in sluglines
- **Theming** — 12 app themes + "Match Theme" paper style that inherits from the app

## Deployment

- Frontend → Vercel (see `client/vercel.json`)
- Server → Railway / Render / Fly (any Node host)
- DB → Supabase

## License

Proprietary — all rights reserved.
