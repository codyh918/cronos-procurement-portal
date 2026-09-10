-- Preserve procurement history while allowing Supabase Auth users to be deleted.
-- Profile and access rows are removed; historical actor/owner references become null.
do $$
declare
  fk record;
  delete_action text;
begin
  for fk in
    select con.conname, ns.nspname schema_name, rel.relname table_name, att.attname column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join unnest(con.conkey) cols(attnum) on true
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = cols.attnum
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and ns.nspname in ('public', 'customer_portal')
      and array_length(con.conkey, 1) = 1
  loop
    delete_action := case
      when fk.schema_name = 'public' and fk.table_name = 'atlas_user_profiles' and fk.column_name = 'auth_user_id' then 'cascade'
      when fk.schema_name = 'customer_portal' and fk.table_name = 'users' and fk.column_name = 'id' then 'cascade'
      when fk.schema_name = 'public' and fk.table_name in ('sewp_user_roles', 'sewp_notification_preferences') and fk.column_name = 'user_id' then 'cascade'
      else 'set null'
    end;
    if delete_action = 'set null' then
      execute format('alter table %I.%I alter column %I drop not null', fk.schema_name, fk.table_name, fk.column_name);
    end if;
    execute format('alter table %I.%I drop constraint %I', fk.schema_name, fk.table_name, fk.conname);
    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references auth.users(id) on delete %s',
      fk.schema_name, fk.table_name, fk.conname, fk.column_name, delete_action
    );
  end loop;
end $$;
