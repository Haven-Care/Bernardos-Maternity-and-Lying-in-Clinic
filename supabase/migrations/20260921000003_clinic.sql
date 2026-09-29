-- ---------------------------------------------------------------------------
-- Clinic configuration: identity, settings, hours, services, slots.
-- Administration, all four tabs.
-- ---------------------------------------------------------------------------

-- Single row. The `id = 1` check is what makes that structural rather than a
-- convention someone has to remember.
create table clinic_info (
  id smallint primary key default 1 check (id = 1),

  name text not null,
  license_no text not null,
  address text not null,
  landline text not null default '',
  mobile text not null default '',
  email text not null default '',
  website text not null default '',

  updated_at timestamptz not null default now()
);

create trigger clinic_info_set_updated_at
  before update on clinic_info
  for each row execute function set_updated_at();

create table clinic_settings (
  id smallint primary key default 1 check (id = 1),

  -- Days before expiry a batch starts appearing in Expiring Soon.
  near_expiry_days integer not null default 30 check (near_expiry_days > 0),
  -- Hours before an appointment that a reminder goes out.
  reminder_lead_hours integer not null default 24 check (reminder_lead_hours > 0),

  -- A ceiling on bookings per day, separate from per-slot capacity: a day can
  -- fill before any single slot does. Comes from the pitch deck, not the Figma,
  -- and has no Administration control yet — null means no ceiling, so it is
  -- dormant until someone gives it a screen or drops it.
  daily_booking_capacity integer check (daily_booking_capacity > 0),

  updated_at timestamptz not null default now()
);

create trigger clinic_settings_set_updated_at
  before update on clinic_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Operating hours
--
-- Keyed by `operating_hours_key`, which is the weekdays plus 'holidays'. The
-- design groups Monday–Friday into one row labelled "Monday – Friday" rather
-- than listing five, so `label` is stored rather than derived from the key.
-- ---------------------------------------------------------------------------
create table operating_hours (
  key operating_hours_key primary key,
  label text not null,

  opens_at clock_time,
  closes_at clock_time,
  closed boolean not null default false,

  -- An open day needs both ends; a closed day must not carry stale times.
  constraint operating_hours_times_match_closed check (
    (closed and opens_at is null and closes_at is null)
    or (not closed and opens_at is not null and closes_at is not null
        and closes_at > opens_at)
  ),

  updated_at timestamptz not null default now()
);

create trigger operating_hours_set_updated_at
  before update on operating_hours
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Services
--
-- Category is free text: the Add Service modal's field is a plain input with
-- placeholder "e.g. Consultation", not a select.
-- ---------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  category text not null default '',
  price numeric(10, 2) not null check (price >= 0),

  -- Deactivating hides a service from the booking form without deleting it,
  -- which would orphan every past appointment that referenced it.
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_set_updated_at
  before update on services
  for each row execute function set_updated_at();

create index services_active_idx on services (active) where active;

-- ---------------------------------------------------------------------------
-- Appointment slots
--
-- Capacity-based, not duration-based. Staff configure fixed clock times per
-- weekday, each holding N patients (08:00 / 2 patients / 1 booked / Open).
-- Nothing in the prototype has a duration, so this is not a conventional
-- scheduler and should not grow into one.
--
-- The column is `slot_time`, not `time`, because `time` is a type name and
-- reads badly unquoted in every query that touches it. The contract's
-- AppointmentSlot.time is restored by the mapper.
-- ---------------------------------------------------------------------------
create table appointment_slots (
  id uuid primary key default gen_random_uuid(),

  weekday weekday not null,
  slot_time clock_time not null,
  capacity integer not null check (capacity > 0),

  -- false is the "Blocked" state. Blocking hides the slot from the public
  -- booking form immediately and leaves existing bookings in it untouched —
  -- the design says so explicitly, and book_appointment honours it.
  is_open boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (weekday, slot_time)
);

create trigger appointment_slots_set_updated_at
  before update on appointment_slots
  for each row execute function set_updated_at();

alter table clinic_info enable row level security;
alter table clinic_settings enable row level security;
alter table operating_hours enable row level security;
alter table services enable row level security;
alter table appointment_slots enable row level security;
