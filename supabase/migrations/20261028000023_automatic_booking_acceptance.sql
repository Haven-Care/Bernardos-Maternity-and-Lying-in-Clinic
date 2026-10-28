-- A successful booking is accepted and reserves capacity immediately.
-- `pending` remains the database spelling of the public Booked status.
begin;

update public.appointments set status = 'pending' where status = 'confirmed';
alter table public.appointments alter column status set default 'pending';
-- Retain the legacy enum value for immutable appointment_status_events history.
alter table public.appointments add constraint appointments_no_confirmation
  check (status <> 'confirmed');

create or replace function public.transition_appointment(
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
    (p_next = 'arrived' and v_previous in ('pending', 'rescheduled')) or
    (p_next = 'completed' and v_previous = 'arrived') or
    (p_next = 'cancelled' and v_previous in ('pending', 'rescheduled', 'arrived')) or
    (p_next = 'no_show' and v_previous in ('pending', 'rescheduled'))
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

create or replace function public.check_reschedule_booking_open() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_status appointment_status;
begin
  select status into v_status from appointments where id = new.booking_id for update;
  if v_status not in ('pending', 'rescheduled') then
    raise exception 'This appointment can no longer be rescheduled.' using errcode = 'HC409';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_reschedule_booking_open() from public, anon, authenticated;
grant execute on function public.check_reschedule_booking_open() to service_role;

commit;
