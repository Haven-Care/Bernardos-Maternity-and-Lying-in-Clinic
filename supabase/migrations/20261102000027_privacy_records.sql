-- ---------------------------------------------------------------------------
-- Data Privacy Act (RA 10173) records.
--
--   patient_consents   proof that a patient accepted a given privacy notice
--   audit_log          who viewed or changed patient records and settings
--   privacy_requests   access, correction, deletion and objection requests
--   retention          notifications expire after a clinic-set period
--
-- All three tables are written only by Express (service_role); the browser
-- keys hold no privileges on them, as migration 26 made the default.
-- ---------------------------------------------------------------------------

begin;

-- Records that must never be edited. One exception: deleting an account sets
-- its foreign keys to null through ON DELETE SET NULL, which is an UPDATE.
-- That is allowed only when nothing else on the row changes, so an account can
-- leave without taking the evidence of what it agreed to with it.
create function private.refuse_record_change() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and (to_jsonb(new) - 'account_id') = (to_jsonb(old) - 'account_id')
     and new.account_id is null then
    return new;
  end if;
  raise exception '% is a record and cannot be changed or deleted.', tg_table_name
    using errcode = 'HC409';
end;
$$;

revoke execute on function private.refuse_record_change() from public;

-- Consent ---------------------------------------------------------------------

create table patient_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references patient_accounts (id) on delete set null,
  -- Matches PRIVACY_NOTICE_VERSION in frontend/src/types/privacy.ts.
  notice_version text not null check (length(notice_version) between 1 and 64),
  -- sign_up: the box ticked on the registration form, recorded at first sign-in.
  -- in_app:  the consent screen, for Google sign-ins and every notice change.
  channel text not null check (channel in ('sign_up', 'in_app')),
  consented_at timestamptz not null default now(),
  unique (account_id, notice_version)
);

comment on table patient_consents is
  'Evidence of consent to the privacy notice, one row per account and notice version.';

create index patient_consents_account_idx on patient_consents (account_id, consented_at desc);
alter table patient_consents enable row level security;

create trigger patient_consents_is_a_record
  before update or delete on patient_consents
  for each row execute function private.refuse_record_change();

-- Audit log -------------------------------------------------------------------
--
-- No foreign keys: the log has to outlive the accounts and records it names,
-- and a key would either block their deletion or erase the trail with them.
-- `details` carries field names and counts, never values: the log records that
-- allergies were edited, not what they say.
create table audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null check (actor_role in ('administrator', 'staff', 'patient', 'system')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_id text,
  patient_id uuid,
  request_id text,
  details jsonb not null default '{}'::jsonb
);

comment on table audit_log is
  'Append-only record of access to and changes of patient data and clinic settings.';

create index audit_log_recent_idx on audit_log (occurred_at desc);
create index audit_log_patient_idx on audit_log (patient_id, occurred_at desc) where patient_id is not null;
create index audit_log_actor_idx on audit_log (actor_id, occurred_at desc);
alter table audit_log enable row level security;

create function private.refuse_audit_change() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'The audit log is append-only.' using errcode = 'HC409';
end;
$$;

revoke execute on function private.refuse_audit_change() from public;

create trigger audit_log_append_only
  before update or delete on audit_log
  for each row execute function private.refuse_audit_change();
create trigger audit_log_refuse_truncate
  before truncate on audit_log
  for each statement execute function private.refuse_truncate_outside_demo();

-- Privacy requests --------------------------------------------------------------

create table privacy_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references patient_accounts (id) on delete set null,
  kind text not null check (kind in ('access', 'correction', 'deletion', 'objection')),
  details text not null default '' check (length(details) <= 2000),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id) on delete set null,
  resolution_note text not null default '' check (length(resolution_note) <= 2000),
  -- Resolved means resolved by someone, at a time, with a note to the record.
  check ((resolved_at is null) = (resolved_by is null and resolution_note = '')
         or (resolved_at is not null and resolution_note <> ''))
);

comment on table privacy_requests is
  'Data-subject requests under RA 10173, answered by the clinic''s administrators.';

create index privacy_requests_open_idx on privacy_requests (submitted_at) where resolved_at is null;
create index privacy_requests_account_idx on privacy_requests (account_id, submitted_at desc);
alter table privacy_requests enable row level security;

-- Retention ---------------------------------------------------------------------
--
-- Notifications repeat patient names and services ("Juana requested Pap smear")
-- and have no purpose once read and old. Medical records are not touched here:
-- their retention follows DOH rules and is never automatic.
alter table clinic_settings
  add column notification_retention_days integer not null default 365
    check (notification_retention_days >= 30);

comment on column clinic_settings.notification_retention_days is
  'Days a notification is kept before purge_expired_notifications() deletes it.';

create function purge_expired_notifications() returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_days integer;
  v_deleted integer;
begin
  select notification_retention_days into v_days from clinic_settings where id = 1;
  delete from notifications where occurred_at < now() - make_interval(days => coalesce(v_days, 365));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function purge_expired_notifications() from public, anon, authenticated;
grant execute on function purge_expired_notifications() to service_role;

select assert_rls_posture();

commit;
