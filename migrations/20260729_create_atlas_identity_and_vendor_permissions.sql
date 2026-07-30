-- Apply after 20260724_create_atlas_data_pilot.sql.
-- This migration does not copy, delete, or replace production users or vendor data.

create table if not exists public.atlas_user_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  username text not null,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'procurement')),
  title text not null default '',
  phone text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  version bigint not null default 1 check (version > 0)
);

create unique index if not exists atlas_user_profiles_username_ci
  on public.atlas_user_profiles (lower(btrim(username)));
create unique index if not exists atlas_user_profiles_email_ci
  on public.atlas_user_profiles (lower(btrim(email)));

create table if not exists public.atlas_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references auth.users(id),
  actor_username text,
  occurred_at timestamptz not null default now(),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.atlas_user_profiles enable row level security;
alter table public.atlas_audit_events enable row level security;

drop policy if exists atlas_profiles_read_own on public.atlas_user_profiles;
create policy atlas_profiles_read_own
on public.atlas_user_profiles for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists atlas_vendors_authenticated_read on public.atlas_vendors;
create policy atlas_vendors_authenticated_read
on public.atlas_vendors for select to authenticated
using (
  exists (
    select 1 from public.atlas_user_profiles p
    where p.auth_user_id = auth.uid() and p.is_active
  )
);

-- Direct browser inserts are permitted only for active authenticated identities.
-- The application still uses the Node API so validation and audit logging cannot be bypassed.
drop policy if exists atlas_vendors_active_user_insert on public.atlas_vendors;
create policy atlas_vendors_active_user_insert
on public.atlas_vendors for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.atlas_user_profiles p
    where p.auth_user_id = auth.uid() and p.is_active
  )
);

revoke insert, update, delete on public.atlas_user_profiles from anon, authenticated;
revoke insert, update, delete on public.atlas_audit_events from anon, authenticated;
revoke insert, update, delete on public.atlas_vendors from anon;
grant select on public.atlas_user_profiles to authenticated;
grant select on public.atlas_vendors to authenticated;
grant insert on public.atlas_vendors to authenticated;

comment on table public.atlas_user_profiles is
  'Atlas application profiles linked one-to-one to Supabase Auth. Passwords are never stored here.';
comment on table public.atlas_audit_events is
  'Server-written Atlas audit events. Metadata must not contain credentials, tokens, or secrets.';

-- Reconciliation report for Auth users that do not yet have linked Atlas profiles.
create or replace view public.atlas_unlinked_auth_users as
select
  u.id as auth_user_id,
  u.email,
  u.created_at as auth_created_at
from auth.users u
left join public.atlas_user_profiles p on p.auth_user_id = u.id
where p.auth_user_id is null;

revoke all on public.atlas_unlinked_auth_users from anon, authenticated;
