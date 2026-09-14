-- Run in Supabase SQL editor as the database owner, before deploying the application.
begin;
create table if not exists public.atlas_managed_funds_legacy_backups (
  project_id text primary key, source jsonb not null, captured_at timestamptz not null default now()
);
create table if not exists public.atlas_managed_funds (
  project_id text primary key, revision bigint not null default 0, state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.atlas_managed_funds_actions (
  id text primary key, project_id text not null references public.atlas_managed_funds(project_id),
  action_number text not null, data jsonb not null, unique(project_id, action_number), unique(project_id,id)
);
create table if not exists public.atlas_managed_funds_transactions (
  id text primary key, project_id text not null references public.atlas_managed_funds(project_id),
  action_id text, data jsonb not null,
  foreign key(project_id,action_id) references public.atlas_managed_funds_actions(project_id,id)
);
create table if not exists public.atlas_managed_funds_invoices (
  id text primary key, project_id text not null references public.atlas_managed_funds(project_id),
  invoice_number text not null, data jsonb not null, unique(project_id,invoice_number), unique(project_id,id)
);
create table if not exists public.atlas_managed_funds_invoice_allocations (
  id text primary key, project_id text not null, invoice_id text not null, action_id text not null,
  amount_cents bigint not null check(amount_cents > 0), data jsonb not null,
  foreign key(project_id,invoice_id) references public.atlas_managed_funds_invoices(project_id,id),
  foreign key(project_id,action_id) references public.atlas_managed_funds_actions(project_id,id),
  unique(invoice_id,action_id)
);
create table if not exists public.atlas_managed_funds_audit (
  id text primary key, project_id text not null references public.atlas_managed_funds(project_id), data jsonb not null
);
create table if not exists public.atlas_managed_funds_documents (
  id text primary key, project_id text not null, action_id text not null, data jsonb not null,
  foreign key(project_id,action_id) references public.atlas_managed_funds_actions(project_id,id)
);
create table if not exists public.atlas_managed_funds_document_links (
  project_id text not null, action_id text not null, document_kind text not null, source_id text not null,
  primary key(project_id,document_kind,source_id),
  foreign key(project_id,action_id) references public.atlas_managed_funds_actions(project_id,id)
);
create index if not exists atlas_mf_transaction_project on public.atlas_managed_funds_transactions(project_id,action_id);

-- Preserve the complete source object, including unknown fields, before changing the label.
insert into public.atlas_managed_funds_legacy_backups(project_id,source)
select p->>'id', p from public.app_records r cross join lateral jsonb_array_elements(r.data) p
where r.record_type='projects' and r.record_key='all' and p->>'projectType'='Checkbook'
on conflict do nothing;
update public.app_records set data=(select coalesce(jsonb_agg(case when p->>'projectType'='Checkbook' then jsonb_set(p,'{projectType}','"Managed Funds"') else p end order by n),'[]'::jsonb) from jsonb_array_elements(data) with ordinality a(p,n))
where record_type='projects' and record_key='all';

do $$ declare tab text; begin
  foreach tab in array array['atlas_managed_funds_legacy_backups','atlas_managed_funds','atlas_managed_funds_actions','atlas_managed_funds_transactions','atlas_managed_funds_invoices','atlas_managed_funds_invoice_allocations','atlas_managed_funds_audit','atlas_managed_funds_documents','atlas_managed_funds_document_links'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from anon, authenticated',tab);
    execute format('grant select, insert, update on public.%I to service_role',tab);
  end loop;
end $$;

create or replace function public.atlas_mf_immutable_row() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'Managed Funds financial history is append-only'; end $$;
drop trigger if exists atlas_mf_immutable_transactions on public.atlas_managed_funds_transactions;
create trigger atlas_mf_immutable_transactions before update or delete on public.atlas_managed_funds_transactions for each row execute function public.atlas_mf_immutable_row();
drop trigger if exists atlas_mf_immutable_audit on public.atlas_managed_funds_audit;
create trigger atlas_mf_immutable_audit before update or delete on public.atlas_managed_funds_audit for each row execute function public.atlas_mf_immutable_row();

create or replace function public.atlas_commit_managed_funds(p_project_id text,p_expected_revision bigint,p_previous_project jsonb,p_project jsonb,p_state jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_projects jsonb; current_project jsonb; old_state jsonb; old_revision bigint; new_revision bigint; item jsonb; allocation jsonb; historical jsonb; next_projects jsonb;
begin
  -- Serialize every project write through the shared collection row, then lock the ledger.
  insert into app_records(record_type,record_key,data) values('projects','all','[]') on conflict(record_type,record_key) do nothing;
  select data into current_projects from app_records where record_type='projects' and record_key='all' for update;
  select p into current_project from jsonb_array_elements(current_projects) p where p->>'id'=p_project_id;
  if (current_project - 'managedFunds') is distinct from (p_previous_project - 'managedFunds') then raise exception 'Project conflict'; end if;
  select state,revision into old_state,old_revision from atlas_managed_funds where project_id=p_project_id for update;
  if coalesce(old_revision,-1) <> p_expected_revision then raise exception 'Revision conflict'; end if;
  if p_state->>'projectId' <> p_project_id or p_project->>'id' <> p_project_id or p_project->>'projectType'<>'Managed Funds' then raise exception 'Invalid project identity'; end if;
  if old_state is not null then
    if p_state->'originalFunding' is distinct from old_state->'originalFunding' then raise exception 'Original funding is immutable'; end if;
    foreach historical in array array['"transactions"'::jsonb,'"audit"'::jsonb,'"commands"'::jsonb] loop
      for item in select value from jsonb_array_elements(old_state->(historical #>> '{}')) loop
        if not (p_state->(historical #>> '{}') @> jsonb_build_array(item)) then raise exception 'Financial history is append-only'; end if;
      end loop;
    end loop;
    for item in select value from jsonb_array_elements(old_state->'actions') loop
      if not exists(select 1 from jsonb_array_elements(p_state->'actions') a where a->>'id'=item->>'id' and a->>'number'=item->>'number') then raise exception 'Actions cannot be removed or renumbered'; end if;
    end loop;
    for item in select value from jsonb_array_elements(old_state->'invoices') loop
      if not exists(select 1 from jsonb_array_elements(p_state->'invoices') i where i->>'id'=item->>'id' and i->'allocations'=item->'allocations' and i->>'number'=item->>'number' and i->'total'=item->'total' and (item->>'status'='Draft' or i=item)) then raise exception 'Invoice history cannot be rewritten'; end if;
    end loop;
    for item in select value from jsonb_array_elements(old_state->'documents') loop
      if not (p_state->'documents' @> jsonb_build_array(item)) then raise exception 'Documents cannot be removed'; end if;
    end loop;
  else
    insert into atlas_managed_funds_legacy_backups(project_id,source) values(p_project_id,coalesce(current_project,p_project)) on conflict do nothing;
  end if;
  new_revision := coalesce(old_revision,0)+1;
  p_state := jsonb_set(p_state,'{revision}',to_jsonb(new_revision));
  insert into atlas_managed_funds(project_id,revision,state) values(p_project_id,new_revision,p_state)
  on conflict(project_id) do update set revision=excluded.revision,state=excluded.state,updated_at=now();
  for item in select value from jsonb_array_elements(p_state->'actions') loop
    insert into atlas_managed_funds_actions(id,project_id,action_number,data) values(item->>'id',p_project_id,item->>'number',item)
    on conflict(id) do update set data=excluded.data where atlas_managed_funds_actions.project_id=excluded.project_id;
  end loop;
  for item in select value from jsonb_array_elements(p_state->'transactions') loop
    insert into atlas_managed_funds_transactions(id,project_id,action_id,data) values(item->>'id',p_project_id,item->>'actionId',item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(p_state->'audit') loop
    insert into atlas_managed_funds_audit(id,project_id,data) values(item->>'id',p_project_id,item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(p_state->'invoices') loop
    insert into atlas_managed_funds_invoices(id,project_id,invoice_number,data) values(item->>'id',p_project_id,item->>'number',item)
    on conflict(id) do update set data=excluded.data where atlas_managed_funds_invoices.project_id=excluded.project_id;
    for allocation in select value from jsonb_array_elements(item->'allocations') loop
      insert into atlas_managed_funds_invoice_allocations(id,project_id,invoice_id,action_id,amount_cents,data) values(allocation->>'id',p_project_id,item->>'id',allocation->>'actionId',(allocation->>'amount')::bigint,allocation) on conflict do nothing;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(p_state->'documents') loop
    insert into atlas_managed_funds_documents(id,project_id,action_id,data) values(item->>'id',p_project_id,item->>'actionId',item) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_project->'quotes','[]')) loop
    insert into atlas_managed_funds_document_links(project_id,action_id,document_kind,source_id) values(p_project_id,item->>'actionId','Customer Quote',item->>'id') on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_project->'purchaseOrders','[]')) loop
    insert into atlas_managed_funds_document_links(project_id,action_id,document_kind,source_id) values(p_project_id,item->>'actionId','Purchase Order',item->>'id') on conflict do nothing;
  end loop;
  p_project := jsonb_set(p_project - 'managedFunds','{managedFundsRevision}',to_jsonb(new_revision));
  select coalesce(jsonb_agg(case when p->>'id'=p_project_id then p_project else p end order by n),'[]') into next_projects from jsonb_array_elements(current_projects) with ordinality a(p,n);
  if current_project is null then next_projects := next_projects || jsonb_build_array(p_project); end if;
  update app_records set data=next_projects,updated_at=now() where record_type='projects' and record_key='all';
  return jsonb_build_object('revision',new_revision);
end $$;
revoke all on function public.atlas_commit_managed_funds(text,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_commit_managed_funds(text,bigint,jsonb,jsonb,jsonb) to service_role;

-- Standard projects keep the existing permissions and workflows. This merge cannot
-- alter/delete any Managed Funds object, including when an old client submits a stale collection.
create or replace function public.atlas_merge_standard_projects(p_projects jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare existing jsonb; merged jsonb;
begin
  if jsonb_typeof(p_projects)<>'array' then raise exception 'Projects must be an array'; end if;
  select data into existing from app_records where record_type='projects' and record_key='all' for update;
  if exists(select 1 from jsonb_array_elements(p_projects) p where p->>'projectType' in ('Managed Funds','Checkbook')) then raise exception 'Managed Funds requires the authenticated API'; end if;
  select coalesce(jsonb_agg(p),'[]') into merged from jsonb_array_elements(p_projects) p where not exists(select 1 from jsonb_array_elements(coalesce(existing,'[]')) e where e->>'id'=p->>'id' and e->>'projectType' in ('Managed Funds','Checkbook'));
  merged := merged || (select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(coalesce(existing,'[]')) p where p->>'projectType' in ('Managed Funds','Checkbook'));
  insert into app_records(record_type,record_key,data) values('projects','all',merged) on conflict(record_type,record_key) do update set data=excluded.data,updated_at=now();
  return merged;
end $$;
revoke all on function public.atlas_merge_standard_projects(jsonb) from public;
grant execute on function public.atlas_merge_standard_projects(jsonb) to anon,authenticated,service_role;

create or replace function public.atlas_guard_managed_project() returns trigger language plpgsql set search_path=public as $$
declare item jsonb; candidate jsonb;
begin
  if current_user in ('postgres','supabase_admin','service_role') then if tg_op='DELETE' then return old; else return new; end if; end if;
  if coalesce(new.record_type,old.record_type)<>'projects' then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op<>'INSERT' then
    for item in select value from jsonb_array_elements(old.data) where value->>'projectType' in ('Managed Funds','Checkbook') loop
      if tg_op='DELETE' then raise exception 'Managed Funds history cannot be deleted'; end if;
      select p into candidate from jsonb_array_elements(new.data) p where p->>'id'=item->>'id';
      if candidate is distinct from item then raise exception 'Managed Funds changes require the authenticated API'; end if;
    end loop;
  end if;
  if tg_op<>'DELETE' then
    for item in select value from jsonb_array_elements(new.data) where value->>'projectType' in ('Managed Funds','Checkbook') loop
      if tg_op='INSERT' or not exists(select 1 from jsonb_array_elements(old.data) p where p=item) then raise exception 'Managed Funds creation requires the authenticated API'; end if;
    end loop;
    return new;
  end if;
  return old;
end $$;
drop trigger if exists atlas_guard_managed_project on public.app_records;
create trigger atlas_guard_managed_project before insert or update or delete on public.app_records for each row execute function public.atlas_guard_managed_project();
insert into storage.buckets(id,name,public,file_size_limit) values('atlas-managed-funds','atlas-managed-funds',false,20971520) on conflict(id) do nothing;
commit;
