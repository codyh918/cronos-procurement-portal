begin;

create table if not exists public.procurement_notes (
  id uuid primary key default gen_random_uuid(), project_id text not null, note_text text not null,
  note_type text not null default 'General' check (note_type in ('General','Weekly Sync')),
  meeting_date date, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.procurement_actions (
  id uuid primary key default gen_random_uuid(), project_id text not null, description text not null,
  owner_id uuid references auth.users(id), assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(),
  due_date date, status text not null default 'Open' check(status in ('Open','In Progress','Complete','Cancelled')),
  priority text not null default 'Medium' check(priority in ('Low','Medium','High','Critical')),
  completed_at timestamptz, comment text, meeting_date date
);
create table if not exists public.procurement_discussion_flags (
  id uuid primary key default gen_random_uuid(), project_id text not null, reason text not null,
  flagged_by uuid references auth.users(id), flagged_at timestamptz not null default now(),
  resolved_at timestamptz, resolved_by uuid references auth.users(id)
);
create table if not exists public.procurement_overrides (
  project_id text primary key, phase text, phase_entered_at timestamptz, health text,
  reason text, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.procurement_activity (
  id bigint generated always as identity primary key, project_id text not null, activity_type text not null,
  previous_value jsonb, new_value jsonb, actor_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.weekly_procurement_meetings (
  id uuid primary key default gen_random_uuid(), meeting_date date not null, started_by uuid references auth.users(id),
  started_at timestamptz not null default now(), completed_at timestamptz, unique(meeting_date)
);
create table if not exists public.weekly_procurement_snapshots (
  id uuid primary key default gen_random_uuid(), meeting_id uuid references public.weekly_procurement_meetings(id) on delete cascade,
  project_id text not null, snapshot jsonb not null, created_at timestamptz not null default now(), unique(meeting_id, project_id)
);

create index if not exists procurement_actions_project_status_due_idx on public.procurement_actions(project_id,status,due_date);
create index if not exists procurement_notes_project_created_idx on public.procurement_notes(project_id,created_at desc);
create index if not exists procurement_discussion_open_idx on public.procurement_discussion_flags(project_id) where resolved_at is null;
create index if not exists procurement_activity_project_created_idx on public.procurement_activity(project_id,created_at desc);
create index if not exists weekly_snapshots_project_created_idx on public.weekly_procurement_snapshots(project_id,created_at desc);

alter table public.procurement_notes enable row level security;
alter table public.procurement_actions enable row level security;
alter table public.procurement_discussion_flags enable row level security;
alter table public.procurement_overrides enable row level security;
alter table public.procurement_activity enable row level security;
alter table public.weekly_procurement_meetings enable row level security;
alter table public.weekly_procurement_snapshots enable row level security;

-- Atlas authorization remains sourced from authenticated user metadata. Procurement users may collaborate;
-- the frontend's centralized leader permission controls access to the portfolio meeting dashboard itself.
do $$ declare t text; begin foreach t in array array['procurement_notes','procurement_actions','procurement_discussion_flags','procurement_overrides','procurement_activity','weekly_procurement_meetings','weekly_procurement_snapshots'] loop
 execute format('drop policy if exists atlas_procurement_team on public.%I',t);
 execute format($p$create policy atlas_procurement_team on public.%I for all to authenticated using (coalesce(auth.jwt()->'app_metadata'->>'atlas_role',auth.jwt()->'user_metadata'->>'atlas_role','procurement') in ('admin','procurement','procurement_leader')) with check (coalesce(auth.jwt()->'app_metadata'->>'atlas_role',auth.jwt()->'user_metadata'->>'atlas_role','procurement') in ('admin','procurement','procurement_leader'))$p$,t);
 end loop; end $$;
commit;
