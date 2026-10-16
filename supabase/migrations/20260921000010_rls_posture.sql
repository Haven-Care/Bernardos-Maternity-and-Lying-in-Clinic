-- ---------------------------------------------------------------------------
-- The security posture, stated once and made checkable.
--
-- Express connects with the service_role key, which bypasses row level security
-- entirely. Per-role policies would therefore be code that never executes, and
-- reviewing them would give a false sense of where authorization happens — it
-- happens in requireStaff / requirePatient, in Express.
--
-- What RLS buys instead: the anon key shipped in the browser grants nothing.
-- Every table is closed, so Supabase's auto-generated PostgREST API is not a
-- second door into the data and Express is the only path by construction.
--
-- Three things have to hold for that to be true, and all three are easy to
-- break by accident later:
--
--   1. RLS is enabled on every table in `public`.
--   2. No policies exist, so "enabled" means "denied".
--   3. The RPCs are not SECURITY DEFINER, so calling one through PostgREST
--      still lands on the caller's own (empty) permissions.
--
-- assert_rls_posture() checks all three. It runs once here, and again from the
-- backend test suite on every CI run — which is what stops a future migration
-- from quietly opening a door.
-- ---------------------------------------------------------------------------

create function assert_rls_posture() returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unprotected text;
  v_policies text;
  v_definer text;
  v_executable text;
begin
  select string_agg(tablename, ', ' order by tablename)
  into v_unprotected
  from pg_tables
  where schemaname = 'public' and not rowsecurity;

  if v_unprotected is not null then
    raise exception
      'RLS posture violated — tables without row level security: %', v_unprotected;
  end if;

  select string_agg(format('%s.%s', tablename, policyname), ', ' order by tablename)
  into v_policies
  from pg_policies
  where schemaname = 'public';

  if v_policies is not null then
    raise exception
      'RLS posture violated — policies exist where none are expected: %. '
      'Authorization belongs in Express; if a policy is genuinely wanted, '
      'change this assertion deliberately.', v_policies;
  end if;

  select string_agg(p.proname, ', ' order by p.proname)
  into v_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef;

  if v_definer is not null then
    raise exception
      'RLS posture violated — SECURITY DEFINER functions bypass the caller''s '
      'permissions and would be reachable through PostgREST: %', v_definer;
  end if;

  -- Postgres grants EXECUTE to PUBLIC on every new function, and anon inherits
  -- it. So a function added by a later migration is callable from the browser
  -- the moment it is created, unless someone remembers to revoke it. Nobody
  -- remembers. This is the check that does.
  select string_agg(distinct p.proname, ', ')
  into v_executable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array['anon', 'authenticated']) as r(role_name)
  where n.nspname = 'public'
    and has_function_privilege(r.role_name, p.oid, 'EXECUTE');

  if v_executable is not null then
    raise exception
      'RLS posture violated — functions executable by anon/authenticated '
      'through PostgREST: %. Revoke them from PUBLIC, not from the roles by '
      'name — the grant comes from PUBLIC and revoking by role leaves it in '
      'place.', v_executable;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defense in depth: nothing in `public` is callable by a browser-held key.
--
-- `from public`, not `from anon, authenticated`. Postgres grants EXECUTE on
-- every new function to the PUBLIC pseudo-role, and anon inherits it from
-- there — so revoking from anon by name leaves the function callable and the
-- revoke looks like it worked. That was verified the hard way: anon could
-- invoke record_stock_out through PostgREST until this line said `public`.
--
-- The deny-all policies already contain the damage, because these functions are
-- invoker-rights and every row they touch is evaluated as the caller. This
-- makes the call fail at the door instead of halfway through, and states the
-- intent plainly: these belong to Express.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

-- service_role inherits from PUBLIC too, so the revoke above takes its access
-- with it — and Express *is* service_role. Without this grant every RPC call
-- and every `default clinic_today()` on an insert fails with a permission
-- error, which is a confusing way to discover the posture is too tight.
grant execute on all functions in schema public to service_role;

select assert_rls_posture();
