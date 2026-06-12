# Cronos Procurement App

Standalone Vue 3 / TypeScript procurement application for Cronos purchasing, quoting, purchase orders, vendor tracking, catalog lookup, user access, and export workflows.

## Project Structure

- Framework: Vue 3 + Vite + TypeScript
- App type: frontend single-page app
- Hosting target: Railway
- Backend/data services: Supabase REST table access through `@supabase/supabase-js`
- Build command: `npm run build`
- Start command: `npm run start`
- Production server: `server.mjs`, serving the built `dist/` folder and listening on `process.env.PORT`

There is no Node API backend in this repo. Browser code must only use public `VITE_` environment variables.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5002`.

## Required Environment Variables

For local development, copy `.env.example` to `.env`.

For Railway, add these variables to the web service:

```bash
NODE_ENV=production
VITE_APP_URL=https://your-railway-domain.up.railway.app
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Railway automatically provides `PORT`; do not set it unless you are intentionally overriding local production testing.

Do not add these to Railway for this frontend app unless you later add backend-only server code:

```bash
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
JWT_SECRET
```

Service-role keys and direct database URLs must never be exposed to Vite/browser code.

## Supabase Setup

The app currently stores shared records in a public schema table named `app_records`. The frontend reads and writes through the Supabase anon/publishable key.

Required table shape:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, record_key)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_records_set_updated_at on public.app_records;
create trigger app_records_set_updated_at
before update on public.app_records
for each row execute function public.set_updated_at();
```

Row Level Security:

- If RLS is disabled, the anon key can read/write according to table grants.
- If RLS is enabled, create policies that allow the app's authenticated/anon access pattern, or writes will fail.
- Recommended production direction: move privileged operations behind Supabase Auth/RLS or a small backend service before storing sensitive customer data at scale.

Supabase Auth redirect URLs, if you enable Supabase Auth later:

```text
http://localhost:5002
http://localhost:5002/*
https://your-railway-domain.up.railway.app
https://your-railway-domain.up.railway.app/*
```

The current Cronos login is app-managed and stored in `app_records`; it does not use Supabase Auth redirects yet.

## Railway Deployment

Railway should deploy from GitHub using the files in this repo:

- `railway.json`: Nixpacks builder, `npm run build`, `npm run start`
- `Procfile`: web process
- `server.mjs`: production static server with SPA fallback

Railway settings:

- Build command: `npm run build`
- Start command: `npm run start`
- Watch path: repository root
- Service type: Web

## GitHub Push

From this project folder:

```bash
git init
git add .
git commit -m "Prepare Atlas procurement app for Railway production"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/YOUR_REPO_NAME.git
git push -u origin main
```

If the repo is already connected:

```bash
git add .
git commit -m "Prepare Atlas procurement app for Railway production"
git push
```

## Production Verification

Run these before deploying:

```bash
npm install
npm run type-check
npm run build
npm run start
```

Then verify:

- App opens locally on the `PORT` shown by `server.mjs`.
- Login works.
- Dashboard loads.
- Protected routes redirect correctly for Procurement Team users.
- Admin routes work for Admin users.
- Admin Settings > Database Sync reports Supabase URL/key present and write succeeds.
- New project/quote/PO data appears in Supabase `public.app_records`.

## Deployment Checklist

1. Push this repo to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add the Railway variables listed above.
4. Deploy.
5. Copy the Railway public domain.
6. Set `VITE_APP_URL` to the final Railway public domain.
7. Redeploy so Vite bakes the production URL into generated links.
8. In Supabase, add the Railway domain to Auth redirect URLs if Supabase Auth is enabled later.
