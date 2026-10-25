-- New submissions reserve capacity immediately, while awaiting staff confirmation.
alter table public.appointments alter column status set default 'pending';

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
  v_patient_id uuid;
  v_appointment appointments;
begin
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
  select daily_booking_capacity into v_daily_cap from clinic_settings where id = 1;

  if v_daily_cap is not null then
    perform pg_advisory_xact_lock(hashtext('day ' || p_scheduled_date::text)::bigint);
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_scheduled_date::text || ' ' || p_slot_time)::bigint
  );

  if p_account_id is null then
    raise exception 'A booking must belong to an account.' using errcode = 'HC400';
  end if;

  -- clinic_today(), not current_date: see the note on that function. Booking
  -- for this morning must not be refused because UTC has not caught up yet.
  if p_scheduled_date < clinic_today() then
    raise exception 'That date has already passed. Please choose another one.'
      using errcode = 'HC400';
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

-- ---------------------------------------------------------------------------
-- Move a booking to another date and time.
--
-- Shared by the staff reschedule modal and the approval of a patient's
-- request. It takes the same locks as book_appointment, in the same order, so
-- a reschedule and a new booking into the last seat of a slot are serialised
-- against each other rather than both passing the count.
--
-- The booking itself is excluded from every count: moving 08:00 to 08:00, or
-- to another time on the same day, must not report the slot or the day as
-- full against itself.
-- ---------------------------------------------------------------------------
create or replace function reschedule_appointment(
  p_booking_id uuid,
  p_scheduled_date date,
  p_slot_time clock_time
)
returns appointments
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking appointments;
  v_slot appointment_slots;
  v_booked integer;
  v_on_date integer;
  v_daily_cap integer;
begin
  select daily_booking_capacity into v_daily_cap from clinic_settings where id = 1;

  if v_daily_cap is not null then
    perform pg_advisory_xact_lock(hashtext('day ' || p_scheduled_date::text)::bigint);
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_scheduled_date::text || ' ' || p_slot_time)::bigint
  );

  select * into v_booking from appointments where id = p_booking_id for update;

  if not found then
    raise exception 'No such booking.' using errcode = 'HC404';
  end if;

  if v_booking.status in ('cancelled', 'completed', 'arrived', 'no_show') then
    raise exception 'A % appointment cannot be rescheduled.', v_booking.status
      using errcode = 'HC409';
  end if;

  if p_scheduled_date < clinic_today() then
    raise exception 'That date has already passed. Please choose another one.'
      using errcode = 'HC400';
  end if;

  select * into v_slot
  from appointment_slots
  where weekday = weekday_of(p_scheduled_date)
    and slot_time = p_slot_time;

  if not found or not v_slot.is_open then
    raise exception 'That time is not available on that date.'
      using errcode = 'HC409';
  end if;

  select count(*) into v_booked
  from appointments
  where scheduled_date = p_scheduled_date
    and slot_time = p_slot_time
    and status <> 'cancelled'
    and id <> p_booking_id;

  if v_booked >= v_slot.capacity then
    raise exception 'That time is fully booked.' using errcode = 'HC409';
  end if;

  if v_daily_cap is not null then
    select count(*) into v_on_date
    from appointments
    where scheduled_date = p_scheduled_date
      and status <> 'cancelled'
      and id <> p_booking_id;

    if v_on_date >= v_daily_cap then
      raise exception 'The clinic is fully booked on that day.'
        using errcode = 'HC409';
    end if;
  end if;

  update appointments
  set scheduled_date = p_scheduled_date,
      slot_time = p_slot_time,
      status = 'rescheduled'
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;


create table public.appointment_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.appointments(id) on delete cascade,
  previous_status public.appointment_status not null,
  next_status public.appointment_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
alter table public.appointment_status_events enable row level security;

-- Serialize transitions with rescheduling and close stale requests atomically.
create function public.transition_appointment(
  p_booking_id uuid, p_next public.appointment_status, p_actor uuid
) returns public.appointments
language plpgsql set search_path = public, pg_temp as $$
declare
  v_booking appointments;
  v_previous appointment_status;
begin
  if not exists (select 1 from profiles where id = p_actor and status = 'active') then
    raise exception 'An active staff account is required.' using errcode = 'HC400';
  end if;
  select * into v_booking from appointments where id = p_booking_id for update;
  if not found then raise exception 'No such booking.' using errcode = 'HC404'; end if;
  v_previous := v_booking.status;
  if not (
    (p_next = 'confirmed' and v_previous in ('pending', 'rescheduled')) or
    (p_next = 'arrived' and v_previous = 'confirmed') or
    (p_next = 'completed' and v_previous = 'arrived') or
    (p_next = 'cancelled' and v_previous in ('pending', 'confirmed', 'rescheduled', 'arrived')) or
    (p_next = 'no_show' and v_previous in ('pending', 'confirmed', 'rescheduled'))
  ) then
    raise exception 'A % appointment cannot be marked %.', v_previous, p_next using errcode = 'HC409';
  end if;
  if p_next in ('arrived', 'completed', 'no_show') and v_booking.scheduled_date > clinic_today() then
    raise exception 'Arrival, completion, and no-show updates are available on the appointment date.' using errcode = 'HC409';
  end if;
  if p_next = 'no_show' and v_booking.scheduled_date = clinic_today()
      and v_booking.slot_time > to_char(now() at time zone 'Asia/Manila', 'HH24:MI') then
    raise exception 'Wait until the appointment time before recording a no-show.' using errcode = 'HC409';
  end if;
  update appointments set status = p_next where id = p_booking_id returning * into v_booking;
  insert into appointment_status_events (booking_id, previous_status, next_status, actor_id)
    values (p_booking_id, v_previous, p_next, p_actor);
  if p_next in ('arrived', 'completed', 'cancelled', 'no_show') then
    update reschedule_requests set status = 'declined', decided_at = now(), decided_by = p_actor
      where booking_id = p_booking_id and status = 'pending';
  end if;
  return v_booking;
end;
$$;
revoke execute on function public.transition_appointment(uuid, public.appointment_status, uuid) from public, anon, authenticated;
grant execute on function public.transition_appointment(uuid, public.appointment_status, uuid) to service_role;

-- Close the race between a patient submitting a request and staff ending a visit.
create function public.check_reschedule_booking_open() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_status appointment_status;
begin
  select status into v_status from appointments where id = new.booking_id for update;
  if v_status not in ('pending', 'confirmed', 'rescheduled') then
    raise exception 'This appointment can no longer be rescheduled.' using errcode = 'HC409';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_reschedule_booking_open() from public, anon, authenticated;
grant execute on function public.check_reschedule_booking_open() to service_role;
create trigger reschedule_booking_open before insert on public.reschedule_requests
  for each row execute function public.check_reschedule_booking_open();
