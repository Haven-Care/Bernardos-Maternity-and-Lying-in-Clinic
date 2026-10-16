-- ---------------------------------------------------------------------------
-- Appointments, and patient-initiated reschedule requests.
-- ---------------------------------------------------------------------------

create table appointments (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique
    default 'BR-' || lpad(nextval('booking_ref_seq')::text, 4, '0'),

  -- Who submitted it. Null for a booking staff entered at the desk.
  account_id uuid references patient_accounts (id) on delete set null,
  -- The clinical record. Materialised on the patient's first booking, so in
  -- practice this is set — but it stays nullable because the record can be
  -- merged or removed without destroying the appointment history.
  patient_id uuid references patients (id) on delete set null,

  -- Contact details as submitted, denormalised on purpose. A booking is a point
  -- in time: if the patient later changes their number, the Booking Requests
  -- row should still show what staff would have called on the day.
  patient_name text not null,
  contact_number text not null default '',
  email text not null default '',

  -- restrict, not cascade: deleting a service that has appointments behind it
  -- would erase what those visits were for. Services are deactivated instead.
  service_id uuid not null references services (id) on delete restrict,
  -- Denormalised so the Booking Requests table renders without a join, and so
  -- a later rename does not rewrite history.
  service_name text not null,

  scheduled_date date not null,
  slot_time clock_time not null,

  -- Accepted on submission. Booking the slot *is* the confirmation — staff
  -- monitor the schedule rather than gate entry to it.
  --
  -- `pending` is retired, not removed: rows created before this change still
  -- carry it and must keep reading correctly, and the Dashboard pie chart is
  -- built around exactly five statuses. Nothing produces it any more.
  --
  -- With no human step between submission and a held seat, the advisory lock in
  -- book_appointment is the only thing standing between two patients and the
  -- same chair. It was always the thing actually enforcing capacity — staff
  -- confirmation never re-checked it — but there is no longer a second pair of
  -- eyes behind it.
  status appointment_status not null default 'confirmed',
  reason_for_visit text not null default '',

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- Capacity counting reads exactly this shape on every booking attempt.
create index appointments_slot_idx
  on appointments (scheduled_date, slot_time)
  where status <> 'cancelled';

create index appointments_status_idx on appointments (status);
create index appointments_account_idx
  on appointments (account_id, submitted_at desc);
create index appointments_patient_idx on appointments (patient_id);

-- ---------------------------------------------------------------------------
-- Reschedule requests
--
-- A patient asking to move an appointment must not move it. The pitch's line is
-- that the app collects requests and does not book appointments, and a patient
-- silently rewriting a confirmed date would contradict it.
--
-- So the proposal lives here rather than on the appointment: the original date
-- stays intact, its slot stays held, and the Dashboard pie chart keeps the five
-- statuses it was designed around instead of growing a sixth wedge.
--
-- Staff cancelling or rescheduling from their own modal does not create a row
-- here — they act directly, because it is their schedule.
-- ---------------------------------------------------------------------------
create table reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references appointments (id) on delete cascade,

  proposed_date date not null,
  proposed_time clock_time not null,

  status reschedule_request_status not null default 'pending',

  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles (id) on delete set null,

  -- A decision needs a decider and a time; an open request has neither.
  constraint reschedule_requests_decision_complete check (
    (status = 'pending' and decided_at is null)
    or (status <> 'pending' and decided_at is not null)
  )
);

-- One open request per booking. Without this a patient could queue five
-- proposals and staff would not know which one approving actually applies.
create unique index reschedule_requests_one_open_per_booking
  on reschedule_requests (booking_id)
  where status = 'pending';

create index reschedule_requests_pending_idx
  on reschedule_requests (requested_at)
  where status = 'pending';

alter table appointments enable row level security;
alter table reschedule_requests enable row level security;
