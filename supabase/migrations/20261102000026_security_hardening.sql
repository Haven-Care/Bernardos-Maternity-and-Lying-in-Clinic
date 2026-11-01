-- ---------------------------------------------------------------------------
-- Security hardening before real patient data.
--
--   1. The browser-held keys hold no table privileges, not only no RLS rows.
--   2. assert_rls_posture() also checks grants, views, storage policies and
--      function search paths.
--   3. A user editing their own user_metadata cannot re-run the role sync.
--   4. Reschedule approvals require an active staff actor, like transitions.
--   5. Booking limits: past times today, a booking window, a per-account cap.
--   6. Patient self-cancellation is one locked, audited transaction.
--   7. Medical records cannot be removed by a cascading delete, and clinical
--      tables cannot be truncated outside a demonstration database.
-- ---------------------------------------------------------------------------

begin;

-- 1. Grants -----------------------------------------------------------------
--
-- Supabase grants anon and authenticated every privilege on every table in
-- `public`, by default privilege. RLS with no policies already returns nothing,
-- but that makes one setting the only barrier: a table created without RLS, or
-- `alter table ... disable row level security` typed in the SQL editor, would
-- open it to anyone holding the publishable key. Express is service_role and
-- keeps its grants.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 2. Function search paths ----------------------------------------------------
--
-- The seven functions Supabase's advisor flags. Every other function already
-- pins its search path; the posture check below now requires it.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) as c(setting)
        where c.setting like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end;
$$;

create or replace function assert_rls_posture() returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unprotected text;
  v_policies text;
  v_definer text;
  v_executable text;
  v_granted text;
  v_definer_views text;
  v_storage_policies text;
  v_unpinned text;
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

  -- RLS is the second wall, not the only one: the browser keys hold no table
  -- privileges at all, so a table that somehow loses RLS stays closed.
  select string_agg(distinct c.relname, ', ')
  into v_granted
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(array['anon', 'authenticated']) as r(role_name)
  where n.nspname = 'public'
    and (
      (c.relkind in ('r', 'p', 'v', 'm', 'f')
        and has_table_privilege(r.role_name, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'))
      or (c.relkind = 'S' and has_sequence_privilege(r.role_name, c.oid, 'USAGE, SELECT, UPDATE'))
    );

  if v_granted is not null then
    raise exception
      'RLS posture violated — anon/authenticated hold privileges on: %. '
      'Revoke them; Express is the only client of these tables.', v_granted;
  end if;

  -- A view runs as its owner unless it says otherwise, which skips the RLS of
  -- every table it reads.
  select string_agg(c.relname, ', ' order by c.relname)
  into v_definer_views
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and not coalesce(
      (select o.option_value::boolean
       from pg_options_to_table(c.reloptions) as o
       where o.option_name = 'security_invoker'),
      false
    );

  if v_definer_views is not null then
    raise exception
      'RLS posture violated — views without security_invoker: %', v_definer_views;
  end if;

  -- Patient documents and medicine photos are reached only through signed URLs
  -- Express issues. A storage policy would be a second, unreviewed door.
  select string_agg(policyname, ', ' order by policyname)
  into v_storage_policies
  from pg_policies
  where schemaname = 'storage';

  if v_storage_policies is not null then
    raise exception
      'RLS posture violated — storage policies exist: %. Files are served '
      'through signed URLs from Express only.', v_storage_policies;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
  into v_unpinned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) as c(setting)
      where c.setting like 'search_path=%'
    );

  if v_unpinned is not null then
    raise exception
      'RLS posture violated — functions without a pinned search_path: %. '
      'Add `set search_path = public, pg_temp`.', v_unpinned;
  end if;
end;
$$;

-- 3. Role sync ----------------------------------------------------------------
--
-- Any signed-in user can rewrite their own raw_user_meta_data through
-- auth.updateUser({ data }). The trigger used to re-run the realm sync on that
-- too, which re-applies app_metadata.staff_role over profiles.role: an
-- administrator demoted in profiles alone could promote themselves back by
-- editing their display name. Only the service-role key can write app_metadata,
-- so only an app_metadata change decides realm and role.
create or replace function private.handle_user_meta_change() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.raw_app_meta_data is distinct from old.raw_app_meta_data then
    perform private.sync_user_realm(
      new.id, new.email, new.raw_app_meta_data, new.raw_user_meta_data
    );
  end if;

  return new;
end;
$$;

-- 4. Reschedule approvals -----------------------------------------------------
--
-- Unchanged except for the first check, which transition_appointment already
-- makes: a deactivated or invented actor must not be recorded as the person
-- who approved a move.
create or replace function approve_reschedule_request(
  p_request_id uuid,
  p_actor uuid
)
returns reschedule_requests
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_request reschedule_requests;
begin
  if not exists (select 1 from profiles where id = p_actor and status = 'active') then
    raise exception 'An active staff account is required.' using errcode = 'HC400';
  end if;

  select * into v_request from reschedule_requests where id = p_request_id for update;

  if not found then
    raise exception 'No such request.' using errcode = 'HC404';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'That request was already %.', v_request.status
      using errcode = 'HC409';
  end if;

  perform reschedule_appointment(
    v_request.booking_id, v_request.proposed_date, v_request.proposed_time
  );

  update reschedule_requests
  set status = 'approved', decided_at = now(), decided_by = p_actor
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- 5. Booking limits -----------------------------------------------------------
--
-- Sign-up is open to anyone, and each booking holds a real seat. Without a cap
-- one account could hold every seat in the week; without a window, a seat in
-- 2099. Both are clinic settings with defaults the clinic can change.
alter table clinic_settings
  add column max_active_bookings_per_account integer not null default 3
    check (max_active_bookings_per_account > 0),
  add column max_booking_days_ahead integer not null default 90
    check (max_booking_days_ahead > 0);

comment on column clinic_settings.max_active_bookings_per_account is
  'Upcoming bookings (pending or rescheduled) one patient account may hold at once.';
comment on column clinic_settings.max_booking_days_ahead is
  'How many days ahead of the clinic day a patient may book.';

-- Copied from 20261022000018_visit_workflow.sql. Changes: the account lock and
-- the three limits after the past-date check; everything else is unchanged.
create or replace function book_appointment(
  p_account_id uuid,
  p_service_id uuid,
  p_scheduled_date date,
  p_slot_time clock_time,
  p_patient_name text,
  p_contact_number text,
  p_email text,
  p_reason_for_visit text
)
returns appointments
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_service services;
  v_slot appointment_slots;
  v_booked integer;
  v_on_date integer;
  v_daily_cap integer;
  v_max_active integer;
  v_max_days integer;
  v_active integer;
  v_patient_id uuid;
  v_appointment appointments;
begin
  if p_account_id is null then
    raise exception 'A booking must belong to an account.' using errcode = 'HC400';
  end if;

  -- One account's bookings are serialised against each other, so two taps on
  -- two phones cannot both pass the per-account count below, nor both create
  -- the account's first patient record. Taken first: always account, then
  -- date, then slot. reschedule_appointment takes no account lock, so no two
  -- callers can wait on these in opposite orders.
  perform pg_advisory_xact_lock(hashtext('account ' || p_account_id::text)::bigint);

  -- Serialise every attempt on this date+time against each other.
  --
  -- Without this the capacity check below is a time-of-check/time-of-use bug:
  -- two patients both read "1 of 2 booked", both pass, and both insert. A
  -- public booking form is precisely where that race gets exercised, and
  -- "double-booking is structurally impossible" is the strongest claim in the
  -- pitch. The lock is held to the end of the transaction and costs nothing
  -- when nobody is competing for the same slot.
  --
  -- The slot lock alone does not protect the day-wide ceiling: two bookings
  -- for different times on the same date take different slot locks and could
  -- both pass the daily count. So when a ceiling is set, the date is locked
  -- too — always date first, then slot, here and in reschedule_appointment,
  -- so the two can never wait on each other in opposite orders.
  select daily_booking_capacity, max_active_bookings_per_account, max_booking_days_ahead
  into v_daily_cap, v_max_active, v_max_days
  from clinic_settings where id = 1;

  if v_daily_cap is not null then
    perform pg_advisory_xact_lock(hashtext('day ' || p_scheduled_date::text)::bigint);
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_scheduled_date::text || ' ' || p_slot_time)::bigint
  );

  -- clinic_today(), not current_date: see the note on that function. Booking
  -- for this morning must not be refused because UTC has not caught up yet.
  if p_scheduled_date < clinic_today() then
    raise exception 'That date has already passed. Please choose another one.'
      using errcode = 'HC400';
  end if;

  if p_scheduled_date = clinic_today()
      and p_slot_time <= to_char(now() at time zone 'Asia/Manila', 'HH24:MI') then
    raise exception 'That time has already passed today. Please choose a later one.'
      using errcode = 'HC400';
  end if;

  if v_max_days is not null and p_scheduled_date > clinic_today() + v_max_days then
    raise exception 'Bookings open up to % days ahead. Please choose an earlier date.', v_max_days
      using errcode = 'HC400';
  end if;

  if v_max_active is not null then
    select count(*) into v_active
    from appointments
    where account_id = p_account_id
      and status in ('pending', 'rescheduled')
      and scheduled_date >= clinic_today();

    if v_active >= v_max_active then
      raise exception
        'You already have % upcoming bookings. Cancel one, or contact the clinic, to book another.',
        v_active
        using errcode = 'HC409';
    end if;
  end if;

  select * into v_service from services where id = p_service_id;
  if not found or not v_service.active then
    raise exception 'That service is no longer offered. Please pick another.'
      using errcode = 'HC400';
  end if;

  select * into v_slot
  from appointment_slots
  where weekday = weekday_of(p_scheduled_date)
    and slot_time = p_slot_time;

  -- A blocked slot is indistinguishable from one that does not exist, and
  -- deliberately so. Staff block a time to stop new bookings; the reason is
  -- theirs and is not a patient's business.
  if not found or not v_slot.is_open then
    raise exception 'That time is no longer available. Please choose another one.'
      using errcode = 'HC409';
  end if;

  select count(*) into v_booked
  from appointments
  where scheduled_date = p_scheduled_date
    and slot_time = p_slot_time
    and status <> 'cancelled';

  if v_booked >= v_slot.capacity then
    raise exception 'That time was just filled. Please choose another one.'
      using errcode = 'HC409';
  end if;

  -- The day-wide ceiling from the pitch deck, separate from per-slot capacity:
  -- a day can fill before any single slot does. Null today, so dormant. Read
  -- above, before the locks, because it decides whether the date is locked.
  if v_daily_cap is not null then
    select count(*) into v_on_date
    from appointments
    where scheduled_date = p_scheduled_date and status <> 'cancelled';

    if v_on_date >= v_daily_cap then
      raise exception
        'The clinic is fully booked on that day. Please choose another date.'
        using errcode = 'HC409';
    end if;
  end if;

  -- Materialise the clinical record on first booking.
  --
  -- Sign-up does not create one: a patient record carries gravida, para, last
  -- menstrual period and attending physician, none of which anyone supplies on
  -- a phone. Creating it here means Patient Records holds only people who have
  -- actually arranged to come in, and staff complete the clinical fields at the
  -- visit.
  select id into v_patient_id from patients where account_id = p_account_id;

  if v_patient_id is null then
    insert into patients (account_id, full_name, contact_number, email)
    values (p_account_id, p_patient_name, p_contact_number, p_email)
    returning id into v_patient_id;
  end if;

  insert into appointments (
    account_id, patient_id,
    patient_name, contact_number, email,
    service_id, service_name,
    scheduled_date, slot_time,
    status, reason_for_visit
  )
  values (
    p_account_id, v_patient_id,
    p_patient_name, p_contact_number, p_email,
    v_service.id, v_service.name,
    p_scheduled_date, p_slot_time,
    -- Hold the seat now; staff confirm the visit separately.
    'pending', coalesce(p_reason_for_visit, '')
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

-- 6. Patient self-cancellation --------------------------------------------------
--
-- Staff changes go through transition_appointment, which records who did it.
-- A patient cancelling from the app used to be a bare UPDATE from Express: no
-- history row, and the open reschedule request closed in a second, separate
-- write. This is the same shape for the patient: locked, checked, recorded.
alter table appointment_status_events
  add column actor_account_id uuid references patient_accounts (id) on delete set null;

comment on column appointment_status_events.actor_account_id is
  'Set when the patient made the change from the app; actor_id is staff.';

create function cancel_own_appointment(p_booking_id uuid, p_account_id uuid)
returns appointments
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking appointments;
  v_previous appointment_status;
begin
  select * into v_booking
  from appointments
  where id = p_booking_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'No such booking.' using errcode = 'HC404';
  end if;

  v_previous := v_booking.status;

  -- Already where the patient wanted it: a double tap is not an error.
  if v_previous = 'cancelled' then
    return v_booking;
  end if;

  if v_previous not in ('pending', 'rescheduled') then
    raise exception 'This visit can now only be managed by clinic staff.' using errcode = 'HC409';
  end if;

  update appointments set status = 'cancelled' where id = p_booking_id returning * into v_booking;

  insert into appointment_status_events (booking_id, previous_status, next_status, actor_account_id)
  values (p_booking_id, v_previous, 'cancelled', p_account_id);

  update reschedule_requests
  set status = 'declined', decided_at = now()
  where booking_id = p_booking_id and status = 'pending';

  return v_booking;
end;
$$;

revoke execute on function cancel_own_appointment(uuid, uuid) from public, anon, authenticated;
grant execute on function cancel_own_appointment(uuid, uuid) to service_role;

-- 7. Medical record durability -------------------------------------------------
--
-- Deleting a patient used to cascade into their clinical notes and documents,
-- and deleting a booking into its status history. Nothing in the app deletes
-- either; this makes sure nothing typed in an SQL editor can do so silently.
alter table clinical_records
  drop constraint clinical_records_patient_id_fkey,
  add constraint clinical_records_patient_id_fkey
    foreign key (patient_id) references patients (id) on delete restrict;

alter table patient_documents
  drop constraint patient_documents_patient_id_fkey,
  add constraint patient_documents_patient_id_fkey
    foreign key (patient_id) references patients (id) on delete restrict;

alter table appointment_status_events
  drop constraint appointment_status_events_booking_id_fkey,
  add constraint appointment_status_events_booking_id_fkey
    foreign key (booking_id) references appointments (id) on delete restrict;

-- TRUNCATE skips row triggers and foreign-key actions, so the restrictions
-- above do not cover it. The demo reset and the local seed truncate on
-- purpose; on any database not marked as a demonstration, the clinical tables
-- refuse. New projects start as production: a database is marked demo by an
-- operator, deliberately, never by default.
create table private.deployment (
  id boolean primary key default true check (id),
  environment text not null default 'production' check (environment in ('production', 'demo'))
);

insert into private.deployment default values;

create function private.refuse_truncate_outside_demo() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce((select environment from private.deployment), 'production') <> 'demo' then
    raise exception
      'Refusing to truncate % on a production database. Clinical records are '
      'never bulk-deleted; see docs/PRODUCTION_CONFIG.md.', tg_table_name;
  end if;
  return null;
end;
$$;

revoke execute on function private.refuse_truncate_outside_demo() from public;

create trigger patients_refuse_truncate
  before truncate on patients
  for each statement execute function private.refuse_truncate_outside_demo();
create trigger clinical_records_refuse_truncate
  before truncate on clinical_records
  for each statement execute function private.refuse_truncate_outside_demo();
create trigger patient_documents_refuse_truncate
  before truncate on patient_documents
  for each statement execute function private.refuse_truncate_outside_demo();
create trigger appointments_refuse_truncate
  before truncate on appointments
  for each statement execute function private.refuse_truncate_outside_demo();
create trigger appointment_status_events_refuse_truncate
  before truncate on appointment_status_events
  for each statement execute function private.refuse_truncate_outside_demo();

-- medicine_photos.updated_at has a column but never had the trigger.
create trigger medicine_photos_set_updated_at
  before update on medicine_photos
  for each row execute function set_updated_at();

select assert_rls_posture();

commit;
