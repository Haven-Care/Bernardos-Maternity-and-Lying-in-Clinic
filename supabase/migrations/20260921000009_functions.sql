-- ---------------------------------------------------------------------------
-- Writes that cannot be done safely from application code.
--
-- supabase-js has no transaction API, so anything that must read-then-write
-- atomically has to live here. All three of these are read-then-write.
--
-- Error convention: business rejections raise a custom SQLSTATE so Express can
-- tell "the patient asked for something not allowed" from "the backend broke".
--
--   HC400  bad request        -> 400
--   HC409  conflict           -> 409
--   anything else             -> 500
--
-- The messages are the ones already written in frontend/src/api/appointments.ts,
-- word for word. They are addressed to a patient, not a developer: the booking
-- form is the only screen in this system a member of the public ever sees.
-- ---------------------------------------------------------------------------

create function book_appointment(
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
  -- a day can fill before any single slot does. Null today, so dormant.
  select daily_booking_capacity into v_daily_cap from clinic_settings where id = 1;

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
    -- Stated here rather than left to the column default, because every rule
    -- this function enforces has already passed by the time we reach this
    -- line: the date is not in the past, the service is offered, the slot is
    -- open, and the seat was counted under the lock. That is the whole of what
    -- confirmation used to mean.
    'confirmed', coalesce(p_reason_for_visit, '')
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record Stock In — creates a batch, or tops up one that already exists.
--
-- Expiry is not overwritten on a top-up. Two deliveries sharing a batch number
-- are the same manufactured lot and expire on the same day; a differing date
-- means the batch number is wrong, and silently taking the newer one would
-- quietly extend the shelf life of stock already on the shelf.
-- ---------------------------------------------------------------------------
create function record_stock_in(
  p_medicine_id uuid,
  p_batch_no text,
  p_quantity integer,
  p_expires_at date,
  p_note text,
  p_actor uuid
)
returns medicine_batches
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_batch medicine_batches;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = 'HC400';
  end if;

  if not exists (select 1 from medicines where id = p_medicine_id) then
    raise exception 'That medicine does not exist.' using errcode = 'HC400';
  end if;

  insert into medicine_batches (medicine_id, batch_no, quantity, expires_at)
  values (p_medicine_id, p_batch_no, p_quantity, p_expires_at)
  on conflict (medicine_id, batch_no) do update
    set quantity = medicine_batches.quantity + excluded.quantity
  returning * into v_batch;

  insert into stock_movements
    (batch_id, medicine_id, type, quantity, note, created_by)
  values
    (v_batch.id, p_medicine_id, 'stock_in', p_quantity, coalesce(p_note, ''), p_actor);

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record Stock Out — draws down a specific batch.
--
-- The row is locked before it is read, so two concurrent dispensals cannot both
-- observe enough stock and both succeed. The `quantity >= 0` check constraint
-- on the table is the backstop if this is ever bypassed.
-- ---------------------------------------------------------------------------
create function record_stock_out(
  p_batch_id uuid,
  p_quantity integer,
  p_note text,
  p_actor uuid
)
returns medicine_batches
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_batch medicine_batches;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = 'HC400';
  end if;

  select * into v_batch from medicine_batches where id = p_batch_id for update;

  if not found then
    raise exception 'That batch does not exist.' using errcode = 'HC400';
  end if;

  if v_batch.quantity < p_quantity then
    raise exception
      'Cannot remove % from batch %: only % remaining.',
      p_quantity, v_batch.batch_no, v_batch.quantity
      using errcode = 'HC409';
  end if;

  update medicine_batches
  set quantity = quantity - p_quantity
  where id = p_batch_id
  returning * into v_batch;

  insert into stock_movements
    (batch_id, medicine_id, type, quantity, note, created_by)
  values
    (v_batch.id, v_batch.medicine_id, 'stock_out', p_quantity,
     coalesce(p_note, ''), p_actor);

  return v_batch;
end;
$$;
