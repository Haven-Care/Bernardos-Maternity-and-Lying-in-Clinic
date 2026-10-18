-- ---------------------------------------------------------------------------
-- Seed — transcribed from frontend/src/mocks/.
--
-- Every date is relative to `clinic_today()`, exactly as the fixtures are relative
-- to today. That is not a stylistic choice: a batch seeded with a literal expiry
-- reads as "5 days left" the week it is written and "expired 200 days ago" by
-- the demo, and the Expiration Tracker would demo as a wall of red.
--
-- Staff accounts are not seeded here. They need rows in `auth.users`, which the
-- provisioning script owns — see the auth phase.
--
-- Resolved design conflicts are recorded in supabase/CONFLICTS.md.
-- ---------------------------------------------------------------------------

begin;

-- Idempotent: `supabase db reset` replays migrations then this file, but
-- `npm run db:seed` can be run against an already-seeded database.
truncate
  reschedule_requests, appointments, stock_movements, medicine_batches,
  medicines, patient_documents, patients, notifications, appointment_slots,
  services, operating_hours, clinic_settings, clinic_info
restart identity cascade;

-- ---------------------------------------------------------------------------
-- Clinic
-- ---------------------------------------------------------------------------

insert into clinic_info (id, name, license_no, address, landline, mobile, email, website)
values (
  1,
  'Bernardo''s Maternity & Lying-in Clinic',
  'DOH-LTO-2025-00417',
  '123 Llano, Caloocan City',
  '(02) 8123 4567',
  '0917 456 7890',
  'bernardo1@havencare.ph',
  'facebook.com/havencareclinic'
);

insert into clinic_settings (id, near_expiry_days, reminder_lead_hours, daily_booking_capacity)
values (1, 30, 24, null);

-- The design groups Monday–Friday into one row rather than listing five, which
-- is why the label is stored rather than derived from the key.
insert into operating_hours (key, label, opens_at, closes_at, closed) values
  ('monday',   'Monday – Friday', '08:00', '17:00', false),
  ('saturday', 'Saturday',        '08:00', '12:00', false),
  ('sunday',   'Sunday',          null,    null,    true),
  ('holidays', 'Holidays',        null,    null,    true);

-- ---------------------------------------------------------------------------
-- Services
--
-- Prices are the prototype's own and are UNCONFIRMED — the clinic sets its
-- pricing, and the Figma disagrees with itself across screens. See CONFLICTS.md.
-- ---------------------------------------------------------------------------

insert into services (id, name, category, price, active) values
  ('5e1c0000-0000-4000-8000-000000000001', 'Pre-natal Check-up', 'Consultation', 300, true),
  ('5e1c0000-0000-4000-8000-000000000002', 'Consultation',       'Consultation', 200, true),
  ('5e1c0000-0000-4000-8000-000000000003', 'Ultrasound',         'Diagnostic',   500, true),
  ('5e1c0000-0000-4000-8000-000000000004', 'Follow-up',          'Consultation', 200, true),
  -- The patient booking wizard offers "Other — tell us during session" but
  -- Services & Pricing has no row for it, so an Other booking would arrive
  -- pointing at a service that does not exist. Giving it a real row is the
  -- smaller change; it is priced 0 because the fee is agreed at the visit.
  ('5e1c0000-0000-4000-8000-000000000005', 'Other',              'Consultation',   0, true);

-- ---------------------------------------------------------------------------
-- Appointment slots
--
-- Monday–Friday share the prototype's five times and capacities. Saturday is
-- the clinic's half-day per Clinic Info, so it runs mornings only. Sunday is
-- closed and therefore has no slots at all — not closed slots, no slots.
-- ---------------------------------------------------------------------------

insert into appointment_slots (weekday, slot_time, capacity, is_open)
select w.weekday, t.slot_time, t.capacity, true
from unnest(array['monday','tuesday','wednesday','thursday','friday']::weekday[])
  as w(weekday)
cross join (values
  ('08:00'::clock_time, 2),
  ('09:00', 1),
  ('10:00', 2),
  ('11:00', 1),
  ('13:00', 2)
) as t(slot_time, capacity);

insert into appointment_slots (weekday, slot_time, capacity, is_open) values
  ('saturday', '08:00', 2, true),
  ('saturday', '09:00', 2, true),
  ('saturday', '10:00', 1, true);

-- One blocked slot, so the "Blocked" badge and the off-state toggle both have
-- something to render without anyone having to go and turn one off first.
update appointment_slots
set is_open = false
where weekday = 'wednesday' and slot_time = '13:00';

-- ---------------------------------------------------------------------------
-- Medicines and batches
--
-- Tuned so the Inventory stat tiles land on interesting numbers with nothing
-- clicked: two medicines below their reorder level, two batches inside the
-- 30-day near-expiry window, none expired.
-- ---------------------------------------------------------------------------

insert into medicines (
  id, generic_name, brand_name, category, dosage_form, dosage, unit,
  reorder_level, unit_cost, selling_price,
  supplier_name, supplier_contact, storage_location, active
) values
  ('11ed0000-0000-4000-8000-000000000001', 'Paracetamol',            'Biogesic',   'Analgesic',  'Tablet',    '500mg',    'pcs',     200,  1.50,   3.00, 'MedLine Distributors', '(02) 8123 4567', 'Cabinet A · Shelf 1',   true),
  ('11ed0000-0000-4000-8000-000000000002', 'Mefenamic Acid',         'Dolfenal',   'Analgesic',  'Capsule',   '500mg',    'pcs',     150,  4.00,   8.00, 'MedLine Distributors', '(02) 8123 4567', 'Cabinet A · Shelf 1',   true),
  ('11ed0000-0000-4000-8000-000000000003', 'Ferrous Sulfate',        'Ferlin',     'Supplement', 'Tablet',    '325mg',    'pcs',      70,  2.00,   5.00, 'Wellness Pharma',      '(02) 8555 0199', 'Cabinet B · Shelf 2',   true),
  ('11ed0000-0000-4000-8000-000000000004', 'Folic Acid',             'Folart',     'Supplement', 'Tablet',    '5mg',      'pcs',     150,  1.25,   3.00, 'Wellness Pharma',      '(02) 8555 0199', 'Cabinet B · Shelf 2',   true),
  ('11ed0000-0000-4000-8000-000000000005', 'Amoxicillin',            'Amoxil',     'Antibiotic', 'Capsule',   '500mg',    'pcs',     120,  6.00,  12.00, 'MedLine Distributors', '(02) 8123 4567', 'Cabinet A · Shelf 3',   true),
  ('11ed0000-0000-4000-8000-000000000006', 'Oral Rehydration Salts', 'Hydrite',    'Supplement', 'Syrup',     '200ml',    'Bottles',  40, 18.00,  35.00, 'Wellness Pharma',      '(02) 8555 0199', 'Storage Room · Rack 1', true),
  ('11ed0000-0000-4000-8000-000000000007', 'Povidone-Iodine',        'Betadine',   'Antiseptic', 'Ointment',  '10%',      'Bottles',  25, 55.00,  95.00, 'CarePlus Supply',      '(02) 8777 2211', 'Storage Room · Rack 2', true),
  ('11ed0000-0000-4000-8000-000000000008', 'Oxytocin',               'Syntocinon', 'Obstetric',  'Injection', '10 IU/mL', 'Vials',    30, 85.00, 140.00, 'CarePlus Supply',      '(02) 8777 2211', 'Refrigerator · Tray 1', true);

insert into medicine_batches (id, medicine_id, batch_no, quantity, expires_at, received_at) values
  -- Paracetamol: one healthy lot and one inside the near-expiry window. This
  -- pair is the clearest demonstration of why batches exist at all.
  ('ba7c0000-0000-4000-8000-000000000001', '11ed0000-0000-4000-8000-000000000001', 'B-2091', 120, clinic_today() +   5, clinic_today() - 240),
  ('ba7c0000-0000-4000-8000-000000000002', '11ed0000-0000-4000-8000-000000000001', 'B-2210', 580, clinic_today() + 410, clinic_today() -  30),
  ('ba7c0000-0000-4000-8000-000000000003', '11ed0000-0000-4000-8000-000000000002', 'B-1884', 340, clinic_today() + 300, clinic_today() -  75),
  -- Ferrous Sulfate: 20 on hand against a reorder level of 70.
  ('ba7c0000-0000-4000-8000-000000000004', '11ed0000-0000-4000-8000-000000000003', 'B-1720',  20, clinic_today() + 190, clinic_today() - 150),
  ('ba7c0000-0000-4000-8000-000000000005', '11ed0000-0000-4000-8000-000000000004', 'B-2044', 700, clinic_today() + 520, clinic_today() -  20),
  ('ba7c0000-0000-4000-8000-000000000006', '11ed0000-0000-4000-8000-000000000005', 'B-1996', 260, clinic_today() + 150, clinic_today() -  90),
  -- Oral Rehydration Salts: inside the near-expiry window.
  ('ba7c0000-0000-4000-8000-000000000007', '11ed0000-0000-4000-8000-000000000006', 'B-1157',  45, clinic_today() +   3, clinic_today() - 330),
  ('ba7c0000-0000-4000-8000-000000000008', '11ed0000-0000-4000-8000-000000000007', 'B-2301',  60, clinic_today() + 600, clinic_today() -  15),
  -- Oxytocin: 12 on hand against a reorder level of 30.
  ('ba7c0000-0000-4000-8000-000000000009', '11ed0000-0000-4000-8000-000000000008', 'B-2288',  12, clinic_today() + 240, clinic_today() -  45);

-- `created_by` is null throughout: these movements predate any provisioned
-- account, and the column exists to survive staff leaving rather than to be
-- backfilled with a guess.
insert into stock_movements (batch_id, medicine_id, type, quantity, note, occurred_at) values
  ('ba7c0000-0000-4000-8000-000000000002', '11ed0000-0000-4000-8000-000000000001', 'stock_in',  600, 'Delivery — MedLine Distributors', (clinic_today() - 30)::timestamptz + interval '7 hours 40 minutes'),
  ('ba7c0000-0000-4000-8000-000000000002', '11ed0000-0000-4000-8000-000000000001', 'stock_out',  20, 'Dispensed to patient',            (clinic_today() -  6)::timestamptz + interval '10 hours 15 minutes'),
  ('ba7c0000-0000-4000-8000-000000000004', '11ed0000-0000-4000-8000-000000000003', 'stock_out',  50, 'Dispensed to patient',            (clinic_today() -  4)::timestamptz + interval '14 hours 5 minutes'),
  ('ba7c0000-0000-4000-8000-000000000005', '11ed0000-0000-4000-8000-000000000004', 'stock_in',  700, 'Delivery — Wellness Pharma',      (clinic_today() - 20)::timestamptz + interval '8 hours 20 minutes'),
  ('ba7c0000-0000-4000-8000-000000000009', '11ed0000-0000-4000-8000-000000000008', 'stock_out',   8, 'Delivery room use',               (clinic_today() -  2)::timestamptz + interval '2 hours 30 minutes'),
  ('ba7c0000-0000-4000-8000-000000000007', '11ed0000-0000-4000-8000-000000000006', 'stock_out',   5, 'Dispensed to patient',            (clinic_today() -  1)::timestamptz + interval '11 hours 45 minutes');

-- ---------------------------------------------------------------------------
-- Patients
--
-- Complete records, as staff would have filled them in at the clinic. None has
-- an account_id: these predate the patient app, which is exactly the walk-in
-- case the system has to keep supporting.
-- ---------------------------------------------------------------------------

insert into patients (
  id, patient_code, full_name, date_of_birth, sex, civil_status,
  contact_number, email, address, occupation, blood_type,
  emergency_contact_name, emergency_contact_number, emergency_contact_relation,
  last_menstrual_period, expected_delivery_date, gravida, para,
  attending_physician, allergies, medical_conditions, visit_type, created_at
) values
  ('9a71e000-0000-4000-8000-000000000001', 'P-108', 'Marian Santos',  '1997-04-12', 'female', 'married', '0969 213 2286', 'mariansantos@gmail.com',  '45 Maligaya St., Barangay 171, Caloocan City', 'Sales Associate', 'O+',  'Rolando Santos', '0917 884 2231', 'Husband', clinic_today() -  70, clinic_today() + 210, 1, 0, 'Dr. Rey Alonzo', 'None reported', 'None reported',                  'prenatal', (clinic_today() - 120)::timestamptz + interval '9 hours 30 minutes'),
  ('9a71e000-0000-4000-8000-000000000002', 'P-109', 'Jane Dela Cruz', '1993-11-02', 'female', 'married', '0918 552 7741', 'jane.delacruz@gmail.com', '12 Llano Road, Caloocan City',                'Teacher',         'A+',  'Mark Dela Cruz', '0927 118 4420', 'Husband', clinic_today() - 210, clinic_today() +  70, 2, 1, 'Dr. Rey Alonzo', 'Penicillin',    'Gestational diabetes — monitored', 'prenatal', (clinic_today() - 300)::timestamptz + interval '10 hours 10 minutes'),
  ('9a71e000-0000-4000-8000-000000000003', 'P-110', 'Chris Chan',     '1999-06-25', 'female', 'single',  '0905 447 1188', 'chrischan@gmail.com',     '8 Camarin Road, Caloocan City',               'Freelancer',      'B+',  'Liza Chan',      '0906 223 9901', 'Mother',  null,               null,               0, 0, 'Dr. Rey Alonzo', 'None reported', 'None reported',                  null,       (clinic_today() -  60)::timestamptz + interval '13 hours 45 minutes'),
  ('9a71e000-0000-4000-8000-000000000004', 'P-111', 'Angela Reyes',   '1990-01-18', 'female', 'married', '0916 330 2255', 'angela.reyes@gmail.com',  '77 Zapote St., Caloocan City',                'Nurse',           'AB+', 'Paolo Reyes',    '0917 445 6612', 'Husband', clinic_today() - 265, clinic_today() +  15, 3, 2, 'Dr. Rey Alonzo', 'None reported', 'Previous caesarean delivery',    'delivery', (clinic_today() - 400)::timestamptz + interval '8 hours 5 minutes'),
  ('9a71e000-0000-4000-8000-000000000005', 'P-112', 'Liza Mercado',   '1995-09-09', 'female', 'single',  '0939 771 0043', 'liza.mercado@gmail.com',  '3 Bagong Silang, Caloocan City',              'Student',         'O-',  'Nora Mercado',   '0921 556 7781', 'Mother',  null,               null,               0, 0, 'Dr. Rey Alonzo', 'None reported', 'None reported',                  null,       (clinic_today() -  45)::timestamptz + interval '15 hours 20 minutes');

-- Keep the sequence ahead of the codes just inserted, so the next patient
-- registered is P-113 rather than a duplicate of P-108.
select setval('patient_code_seq', 112, true);

-- ---------------------------------------------------------------------------
-- Appointments
--
-- Built rather than listed, because every row has to land in a real slot on a
-- real open weekday without exceeding that slot's capacity — the same rule
-- book_appointment enforces. Hand-written rows would fall out of agreement with
-- the slot grid the moment either changed.
--
-- The spread mirrors the prototype: a history of completed visits, today's
-- schedule, and confirmed bookings ahead.
--
-- No `pending` rows. Bookings are accepted on submission, so seeding a queue of
-- unreviewed requests would demo a screen that no longer exists and leave the
-- status filter showing a value nothing can produce.
-- ---------------------------------------------------------------------------

with spec(day_offset, status) as (
  values
    (-21, 'completed'), (-18, 'completed'), (-16, 'cancelled'), (-14, 'completed'),
    (-11, 'completed'), ( -9, 'rescheduled'), (-7, 'completed'), (-6, 'completed'),
    ( -4, 'cancelled'), ( -3, 'completed'), (-2, 'completed'),   (-1, 'completed'),
    (  0, 'confirmed'), (  0, 'confirmed'),  ( 0, 'confirmed'),  ( 0, 'completed'),
    (  0, 'confirmed'), (  1, 'confirmed'),  ( 1, 'confirmed'),  ( 2, 'confirmed'),
    (  2, 'rescheduled'), (3, 'confirmed'),  ( 4, 'confirmed'),
    (  2, 'confirmed'), (  3, 'confirmed'),  ( 5, 'confirmed'),  ( 6, 'confirmed'),
    (  8, 'confirmed')
),
-- Sunday has no slots, so a booking that lands there moves to Monday rather
-- than being silently dropped.
dated as (
  select
    row_number() over (order by day_offset, status) as n,
    status::appointment_status as status,
    case
      when weekday_of(clinic_today() + day_offset) = 'sunday'
        then clinic_today() + day_offset + 1
      else clinic_today() + day_offset
    end as scheduled_date
  from spec
),
numbered as (
  select
    d.*,
    row_number() over (partition by d.scheduled_date order by d.n) as within_day
  from dated d
),
-- Every seat in every open slot on the dates we need, numbered within its date.
-- A slot with capacity 2 contributes two seats, which is what keeps the result
-- inside the capacity the booking function would enforce.
seats as (
  select
    d.scheduled_date,
    s.slot_time,
    row_number() over (
      partition by d.scheduled_date order by s.slot_time, seat.n
    ) as seat_no
  from (select distinct scheduled_date from dated) d
  join appointment_slots s on s.weekday = weekday_of(d.scheduled_date)
  cross join lateral generate_series(1, s.capacity) as seat(n)
  where s.is_open
),
assigned as (
  select nd.n, nd.status, nd.scheduled_date, seats.slot_time
  from numbered nd
  join seats
    on seats.scheduled_date = nd.scheduled_date
   and seats.seat_no = nd.within_day
)
insert into appointments (
  reference_no, patient_id, patient_name, contact_number, email,
  service_id, service_name, scheduled_date, slot_time, status,
  reason_for_visit, submitted_at
)
select
  'BR-' || lpad((811 + a.n)::text, 4, '0'),
  p.id,
  p.full_name,
  p.contact_number,
  p.email,
  sv.id,
  sv.name,
  a.scheduled_date,
  a.slot_time,
  a.status,
  -- One value now that no row is pending. Kept as a column rather than folded
  -- into the insert so the shape still reads as "per booking".
  'Routine visit.',
  -- Three days before the visit, but never in the future.
  --
  -- The unclamped form dates a request for next week to next week, so six
  -- seeded bookings claimed to have been submitted on a day that has not
  -- happened. That is nonsense on its own terms, and it leaks: the Dashboard's
  -- "Oldest submitted" alert had to guard against a negative age, and the
  -- notification rows derived from these timestamps sorted *above* genuinely
  -- new ones, pushing a real booking below four fixtures in a newest-first
  -- dropdown.
  --
  -- Staggered by `a.n` rather than all pinned to now(), so the clamped rows
  -- still have a distinct order for "oldest" to mean something.
  least(
    (a.scheduled_date - 3)::timestamptz + interval '14 hours 20 minutes',
    now() - (a.n * interval '3 hours')
  )
from assigned a
join lateral (
  select id, full_name, contact_number, email
  from patients
  order by patient_code
  offset (a.n - 1) % 5
  limit 1
) p on true
join lateral (
  select id, name
  from services
  where name <> 'Other'
  order by name
  offset (a.n - 1) % 4
  limit 1
) sv on true;

select setval('booking_ref_seq', 811 + (select count(*) from appointments), true);

-- ---------------------------------------------------------------------------
-- Notifications
--
-- Derived from the appointments just inserted rather than written out, so the
-- dropdown says the same thing the Bookings tab does.
--
-- Seeded at all because nothing above goes through book_appointment: these rows
-- are inserted directly and carry no account_id, so the notify trigger does not
-- fire for them. Without this the bell is empty on a fresh database and the
-- feature looks broken rather than quiet. Every notification after the first
-- patient books is written by the trigger.
--
-- The five most recently submitted, rather than the pending ones this used to
-- select — nothing is pending any more, and that predicate would have left the
-- bell empty. Cancelled bookings are excluded: a notification announcing an
-- appointment that is not happening is worse than no notification.
--
-- The oldest of the five is marked read; the rest are not. One read row is what
-- shows the dropdown's two states at a glance.
-- ---------------------------------------------------------------------------
insert into notifications (message, href, read, occurred_at)
select
  message, href, read, occurred_at
from (
  select
    a.patient_name || ' booked ' || a.service_name
      || ' on ' || short_date(a.scheduled_date) || ', ' || a.slot_time
      as message,
    '/admin/appointments' as href,
    -- Ranked rather than cut off by age: the seeded submitted_at values are
    -- relative to clinic_today(), so a fixed interval would put every row on
    -- the same side of it.
    row_number() over (order by a.submitted_at desc) = 5 as read,
    a.submitted_at as occurred_at
  from appointments a
  where a.status <> 'cancelled'
  order by a.submitted_at desc
  limit 5
) recent;

commit;
