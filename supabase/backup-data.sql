-- Run in the Supabase SQL editor as the database owner and export the result
-- as CSV. The backup cell is JSON containing private application records.
-- Store the download in private-backups/, never in a tracked source file.
-- The helper exists only in this database session's temporary schema.
-- STABLE SELECTs share the calling query snapshot:
-- https://www.postgresql.org/docs/current/xfunc-volatility.html
create or replace function pg_temp.havencare_data_snapshot()
returns jsonb
language plpgsql stable
set search_path = pg_catalog, pg_temp
as $$
declare
  source_table record;
  source_rows jsonb;
  tables_snapshot jsonb := '{}'::jsonb;
begin
  for source_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p') and not c.relispartition
    order by n.nspname, c.relname
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %I.%I t',
      source_table.schema_name, source_table.table_name
    ) into source_rows;
    tables_snapshot := tables_snapshot || jsonb_build_object(
      source_table.schema_name || '.' || source_table.table_name,
      jsonb_build_object('count', jsonb_array_length(source_rows), 'rows', source_rows)
    );
  end loop;
  return jsonb_build_object(
    'format', 'havencare-public-data-snapshot-v1',
    'exported_at', current_timestamp,
    'database', current_database(),
    'server_version', current_setting('server_version'),
    'tables', tables_snapshot,
    'columns', (select jsonb_agg(to_jsonb(c)) from information_schema.columns c
      where c.table_schema in ('public', 'private')),
    'constraints', (select jsonb_agg(jsonb_build_object('schema', n.nspname,
      'table', c.relname, 'name', k.conname, 'definition', pg_get_constraintdef(k.oid)))
      from pg_constraint k join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'private')),
    'indexes', (select jsonb_agg(to_jsonb(i)) from pg_indexes i
      where i.schemaname in ('public', 'private')),
    'views', (select jsonb_agg(to_jsonb(v)) from pg_views v
      where v.schemaname in ('public', 'private')),
    'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p
      where p.schemaname in ('public', 'private')),
    'functions', (select jsonb_agg(jsonb_build_object('schema', n.nspname,
      'name', p.proname, 'definition', pg_get_functiondef(p.oid)))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')),
    'triggers', (select jsonb_agg(jsonb_build_object('schema', n.nspname,
      'table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid)))
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'private') and not t.tgisinternal),
    'sequences', (select jsonb_agg(to_jsonb(s)) from pg_sequences s
      where s.schemaname in ('public', 'private')),
    'enums', (select jsonb_agg(jsonb_build_object('schema', n.nspname,
      'name', t.typname, 'label', e.enumlabel, 'sort_order', e.enumsortorder))
      from pg_enum e join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname in ('public', 'private'))
  );
end;
$$;

select pg_temp.havencare_data_snapshot() as backup;
