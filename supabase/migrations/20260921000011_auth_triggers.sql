-- ---------------------------------------------------------------------------
-- Account provisioning: one auth.users row becomes one application row.
--
-- A `private` schema, not `public`, and that matters.
--
-- These functions have to be SECURITY DEFINER: the write to auth.users is
-- performed by `supabase_auth_admin`, which has no rights on our tables, so the
-- trigger must run as its owner to write them. But a SECURITY DEFINER function
-- sitting in `public` is exposed as a PostgREST RPC endpoint and runs with the
-- owner's full privileges — which is the single most effective way to hand a
-- browser a superuser. PostgREST only exposes schemas it is configured for, and
-- `private` is not one of them, so putting them here makes them unreachable
-- from outside the database.
--
-- It is also why assert_rls_posture() forbids SECURITY DEFINER in `public`
-- rather than everywhere: this is the legitimate use, and it is quarantined.
-- ---------------------------------------------------------------------------

create schema private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which realm an account belongs to.
--
-- Read from `raw_app_meta_data`, never `raw_user_meta_data`. The browser's
-- signUp() writes user metadata freely — it is the `data` argument — so if the
-- realm were read from there, any patient could register themselves as staff
-- and walk into the admin portal. App metadata can only be set with the
-- service_role key, which is what makes the provisioning service the only
-- thing able to mint a staff account.
--
-- Absent or unrecognised therefore means patient: a self-registration through
-- the public sign-up form carries no user_type at all, and the safe default is
-- the realm with no privileges.
-- ---------------------------------------------------------------------------
create function private.sync_user_realm(
  p_user_id uuid,
  p_email text,
  p_app_meta jsonb,
  p_user_meta jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := coalesce(
    nullif(trim(p_user_meta ->> 'full_name'), ''),
    split_part(p_email, '@', 1)
  );
  v_contact text := coalesce(p_user_meta ->> 'contact_number', '');
begin
  if p_app_meta ->> 'user_type' = 'staff' then
    -- Promotion path. The insert below ran first and made this account a
    -- patient, because GoTrue's admin API creates the user and only then
    -- writes app_metadata — so at insert time there was no user_type to read.
    -- Clearing it here is what makes the two-step write converge on one row.
    delete from public.patient_accounts where id = p_user_id;

    -- Checked rather than written as an upsert, because `employee_id` defaults
    -- to nextval() and Postgres evaluates column defaults on the *attempted*
    -- insert even when it lands in ON CONFLICT DO UPDATE. This function runs
    -- more than once per account — GoTrue writes the user, then its metadata —
    -- so an upsert quietly burns an employee number every time, and the clinic
    -- gets EMP-0001, EMP-0003, EMP-0005.
    if exists (select 1 from public.profiles where id = p_user_id) then
      update public.profiles
      set email = p_email,
          role = coalesce(p_app_meta ->> 'staff_role', 'staff')::staff_role
      where id = p_user_id;
    else
      insert into public.profiles (id, full_name, email, contact_number, role)
      values (
        p_user_id, v_name, p_email, v_contact,
        coalesce(p_app_meta ->> 'staff_role', 'staff')::staff_role
      );
    end if;

    insert into public.notification_prefs (profile_id)
    values (p_user_id)
    on conflict (profile_id) do nothing;
  else
    -- No demotion path on purpose. Removing user_type from a staff account
    -- should not silently delete their profile and the audit trail hanging off
    -- it; deactivating staff is an explicit action with its own status column.
    if not exists (select 1 from public.profiles where id = p_user_id) then
      insert into public.patient_accounts (id, full_name, email, contact_number)
      values (p_user_id, v_name, p_email, v_contact)
      on conflict (id) do nothing;
    end if;
  end if;
end;
$$;

create function private.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.sync_user_realm(
    new.id, new.email, new.raw_app_meta_data, new.raw_user_meta_data
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Catches the second half of GoTrue's two-step create, and any later change of
-- realm. Scoped to the metadata column so ordinary sign-ins, which touch
-- last_sign_in_at, do not fire it.
create function private.handle_user_meta_change() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.raw_app_meta_data is distinct from old.raw_app_meta_data
     or new.raw_user_meta_data is distinct from old.raw_user_meta_data then
    perform private.sync_user_realm(
      new.id, new.email, new.raw_app_meta_data, new.raw_user_meta_data
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_meta_changed
  after update of raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function private.handle_user_meta_change();

-- ---------------------------------------------------------------------------
-- Keep the mirrored email in step.
--
-- profiles.email and patient_accounts.email are copies, so staff listings and
-- the Booking Requests table never join across into the auth schema. A copy
-- that is never refreshed goes stale the first time someone changes address.
-- ---------------------------------------------------------------------------
create function private.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
    update public.patient_accounts set email = new.email where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();
