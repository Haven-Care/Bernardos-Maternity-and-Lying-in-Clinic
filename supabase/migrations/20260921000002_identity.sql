-- ---------------------------------------------------------------------------
-- Identity: staff profiles and patient accounts.
--
-- Both realms live in one `auth.users` table and are told apart by
-- `raw_app_meta_data->>'user_type'` ('staff' | 'patient'), set with the
-- service_role key at creation. It must be app metadata, never user metadata:
-- the latter is editable by the user it describes, so a patient could promote
-- themselves to staff.
--
-- The rows here are the application-side half of each account. The triggers
-- that create them on sign-up land in the auth phase, not this one.
-- ---------------------------------------------------------------------------

-- Staff. Provisioned only — there is no self sign-up on the admin side.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  full_name text not null,
  employee_id text not null unique
    default 'EMP-' || lpad(nextval('employee_id_seq')::text, 4, '0'),
  role staff_role not null default 'staff',
  status staff_status not null default 'active',
  contact_number text not null default '',

  -- Mirrored from auth.users so staff listings and the Booking Requests table
  -- never have to join across into the auth schema. Kept in step by the
  -- provisioning service, which owns both writes.
  email text not null,

  hired_at date not null default clinic_today(),

  -- The contract types both of these as non-null DateTimeString, so a freshly
  -- provisioned account starts with now() rather than null.
  last_login_at timestamptz not null default now(),
  password_changed_at timestamptz not null default now(),

  avatar_url text,

  -- The design shows this toggle already off. Enrolment and challenge flows are
  -- real work; it ships visibly disabled rather than faked.
  two_factor_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Administration > My Account > Notification Preferences.
create table notification_prefs (
  profile_id uuid primary key references profiles (id) on delete cascade,

  -- Email only. SMS is out of scope: Philippine gateways bill per message and
  -- the client has no budget for it (Proposal Limitation 2).
  email_notifications boolean not null default true,
  new_booking_alerts boolean not null default true,

  updated_at timestamptz not null default now()
);

create trigger notification_prefs_set_updated_at
  before update on notification_prefs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Patients (the account, not the clinical record)
--
-- Self-registered. Holds only what someone can reasonably supply on a phone:
-- who they are and how to reach them.
--
-- The clinical record — gravida, para, last menstrual period, attending
-- physician — is a separate table, created at the patient's first booking and
-- completed by staff at the visit. Nobody fills that in at sign-up, and an
-- account that never books should not leave an empty row in Patient Records.
-- ---------------------------------------------------------------------------
create table patient_accounts (
  id uuid primary key references auth.users (id) on delete cascade,

  full_name text not null,
  contact_number text not null default '',
  email text not null,

  -- Mobile screen U43, Notification Setting.
  email_notifications boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patient_accounts_set_updated_at
  before update on patient_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Enabled with no policies, here and on every table that follows. Express holds
-- the service_role key, which bypasses RLS entirely, so per-role policies would
-- be code that never executes.
--
-- What this does buy: the anon key shipped in the browser grants nothing. Every
-- table is closed to it, so the auto-generated PostgREST API is not a second
-- way into the data, and Express is the only path by construction.
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table notification_prefs enable row level security;
alter table patient_accounts enable row level security;
