-- Run only against a disposable migrated/seeded development database.
-- Auth users and business records are synthetic; the transaction is rolled back.
begin;
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111119', 'visit-staff@example.test', '{"user_type":"staff"}', '{"full_name":"Visit Test Staff"}'),
  ('22222222-2222-4222-8222-222222222229', 'visit-patient@example.test', '{}', '{"full_name":"Visit Test Patient"}');

do $$
declare
  v_actor uuid := '11111111-1111-4111-8111-111111111119';
  v_account uuid := '22222222-2222-4222-8222-222222222229';
  v_date date;
  v_service uuid;
  v_medicine uuid;
  v_before integer;
  v_after integer;
  v_booking appointments;
  v_cancel appointments;
  v_missed appointments;
  v_batch medicine_batches;
begin
  select id into v_service from services where name = 'Consultation' and active limit 1;
  select d::date into v_date from generate_series(clinic_today() + 14, clinic_today() + 21, interval '1 day') as d
    where exists (select 1 from appointment_slots where weekday = weekday_of(d::date) and slot_time = '09:00' and is_open)
    order by d limit 1;
  select booked into v_before from slot_availability(v_date) where slot_time = '09:00';
  v_booking := book_appointment(v_account, v_service, v_date, '09:00', 'Visit Test Patient', '09123456789', 'visit-patient@example.test', 'Synthetic workflow test');
  assert v_booking.status = 'pending', 'New bookings must await staff confirmation';
  select booked into v_after from slot_availability(v_date) where slot_time = '09:00';
  assert v_after = v_before + 1, 'An unconfirmed booking must reserve capacity';
  v_booking := transition_appointment(v_booking.id, 'confirmed', v_actor);
  begin
    perform transition_appointment(v_booking.id, 'arrived', v_actor);
    raise exception 'Future arrival should fail';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform transition_appointment(v_booking.id, 'completed', v_actor);
    raise exception 'Completion without arrival should fail';
  exception when sqlstate 'HC409' then null; end;
  -- Move the synthetic fixture to today to exercise same-day visit updates.
  update appointments set scheduled_date = clinic_today() where id = v_booking.id;
  insert into reschedule_requests(booking_id, proposed_date, proposed_time) values(v_booking.id, v_date + 1, '10:00');
  v_booking := transition_appointment(v_booking.id, 'arrived', v_actor);
  assert not exists(select 1 from reschedule_requests where booking_id = v_booking.id and status = 'pending'), 'Arrival must close stale reschedule requests';
  v_booking := transition_appointment(v_booking.id, 'completed', v_actor);
  assert v_booking.status = 'completed', 'An arrived visit can complete on the same day';
  assert (select count(*) from appointment_status_events where booking_id = v_booking.id) = 3, 'Transitions must retain staff audit events';
  begin
    perform transition_appointment(v_booking.id, 'confirmed', v_actor);
    raise exception 'Completed visits must remain terminal';
  exception when sqlstate 'HC409' then null; end;
  begin
    insert into reschedule_requests(booking_id, proposed_date, proposed_time) values(v_booking.id, v_date + 1, '10:00');
    raise exception 'A completed visit must not accept new reschedule requests';
  exception when sqlstate 'HC409' then null; end;

  v_cancel := book_appointment(v_account, v_service, v_date, '09:00', 'Visit Test Patient', '09123456789', 'visit-patient@example.test', 'Synthetic cancellation');
  insert into reschedule_requests(booking_id, proposed_date, proposed_time) values(v_cancel.id, v_date + 1, '10:00');
  select booked into v_before from slot_availability(v_date) where slot_time = '09:00';
  v_cancel := transition_appointment(v_cancel.id, 'cancelled', v_actor);
  select booked into v_after from slot_availability(v_date) where slot_time = '09:00';
  assert v_after = v_before - 1, 'Cancellation must release the reserved seat';
  assert not exists(select 1 from reschedule_requests where booking_id = v_cancel.id and status = 'pending'), 'Cancellation must close reschedule requests';
  begin
    perform transition_appointment(v_cancel.id, 'confirmed', v_actor);
    raise exception 'Cancelled visits must remain terminal';
  exception when sqlstate 'HC409' then null; end;

  v_missed := book_appointment(v_account, v_service, v_date, '09:00', 'Visit Test Patient', '09123456789', 'visit-patient@example.test', 'Synthetic no-show');
  begin
    perform transition_appointment(v_missed.id, 'no_show', v_actor);
    raise exception 'Future no-show should fail';
  exception when sqlstate 'HC409' then null; end;
  update appointments set scheduled_date = clinic_today(), slot_time = '23:59' where id = v_missed.id;
  if to_char(now() at time zone 'Asia/Manila', 'HH24:MI') < '23:59' then
    begin
      perform transition_appointment(v_missed.id, 'no_show', v_actor);
      raise exception 'An appointment time that has not passed cannot be a no-show';
    exception when sqlstate 'HC409' then null; end;
  end if;
  update appointments set scheduled_date = clinic_today() - 1 where id = v_missed.id;
  v_missed := transition_appointment(v_missed.id, 'no_show', v_actor);
  assert v_missed.status = 'no_show', 'A missed appointment can be recorded';
  begin
    perform reschedule_appointment(v_missed.id, v_date, '09:00');
    raise exception 'A no-show must remain terminal';
  exception when sqlstate 'HC409' then null; end;

  select id into v_medicine from medicines order by id limit 1;
  v_batch := record_stock_in(v_medicine, '', 1, clinic_today() + 90, 'Synthetic generated batch', v_actor);
  assert v_batch.batch_no ~ '^B-[A-F0-9]{16}$', 'An omitted batch number must be generated';
  v_batch := record_stock_in(v_medicine, 'LOT#2026_A/1.0', 1, clinic_today() + 90, 'Synthetic custom batch', v_actor);
  assert v_batch.batch_no = 'LOT#2026_A/1.0', 'Custom batch numbers must be retained';
  begin
    perform record_stock_in(v_medicine, 'LOT;<script>', 1, clinic_today() + 90, 'Invalid batch', v_actor);
    raise exception 'Unsupported batch punctuation should fail';
  exception when sqlstate 'HC400' then null; end;
  assert exists(select 1 from services where name = 'IUD' and active and price_is_temporary and price = 100), 'Missing services must have labelled temporary prices';
  assert exists(select 1 from services where name = 'Pre-natal Check-up' and price = 300 and not price_is_temporary), 'Existing rates must survive catalog setup';
end;
$$;
select public.assert_rls_posture();
rollback;
