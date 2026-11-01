-- Run only against a disposable migrated/seeded development database.
-- Auth users and business records are synthetic; the transaction is rolled back.
begin;
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('33333333-3333-4333-8333-333333333331', 'hardening-admin@example.test', '{"user_type":"staff","staff_role":"administrator"}', '{"full_name":"Hardening Admin"}'),
  ('33333333-3333-4333-8333-333333333332', 'hardening-patient@example.test', '{}', '{"full_name":"Hardening Patient"}'),
  ('33333333-3333-4333-8333-333333333333', 'hardening-other@example.test', '{}', '{"full_name":"Other Patient"}');

do $$
declare
  v_admin uuid := '33333333-3333-4333-8333-333333333331';
  v_account uuid := '33333333-3333-4333-8333-333333333332';
  v_other uuid := '33333333-3333-4333-8333-333333333333';
  v_service uuid;
  v_dates date[];
  v_times text[];
  v_booking appointments;
  v_cancelled appointments;
  v_request uuid;
  v_events integer;
begin
  -- Browser-held keys hold no table privileges at all.
  assert not has_table_privilege('anon', 'public.patients', 'SELECT'), 'anon must not read patients';
  assert not has_table_privilege('authenticated', 'public.clinical_records', 'SELECT'), 'authenticated must not read clinical records';
  assert not has_table_privilege('anon', 'public.patient_list', 'SELECT'), 'anon must not read the patient_list view';
  assert has_table_privilege('service_role', 'public.patients', 'SELECT, INSERT, UPDATE'), 'Express keeps its access';

  -- Editing one's own user_metadata must not re-apply app_metadata.staff_role.
  update profiles set role = 'staff' where id = v_admin;
  update auth.users set raw_user_meta_data = '{"full_name":"Renamed Admin"}' where id = v_admin;
  assert (select role from profiles where id = v_admin) = 'staff', 'A user_metadata edit must not restore a demoted role';
  -- A service-role change of app_metadata still syncs.
  update auth.users set raw_app_meta_data = '{"user_type":"staff","staff_role":"administrator","provider":"email"}' where id = v_admin;
  assert (select role from profiles where id = v_admin) = 'administrator', 'An app_metadata change must still sync the role';

  select id into v_service from services where name = 'Pre-natal Check-up (first visit)' and active limit 1;
  -- The first free slot on each of the next five open days.
  select array_agg(d order by d), array_agg(t order by d) into v_dates, v_times from (
    select distinct on (x.d) x.d, a.slot_time::text as t
    from generate_series(clinic_today() + 1, clinic_today() + 40, interval '1 day') as g(day)
    cross join lateral (select g.day::date as d) as x
    cross join lateral slot_availability(x.d) as a
    where a.available
    order by x.d, a.slot_time
    limit 5
  ) as free_seats;

  -- Booking window.
  begin
    perform book_appointment(v_account, v_service, clinic_today() + 400, '09:00', 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'Too far ahead');
    raise exception 'A booking past the window must fail';
  exception when sqlstate 'HC400' then null; end;

  -- Per-account cap (default 3), counted across separate days.
  perform book_appointment(v_account, v_service, v_dates[1], v_times[1], 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'One');
  perform book_appointment(v_account, v_service, v_dates[2], v_times[2], 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'Two');
  v_booking := book_appointment(v_account, v_service, v_dates[3], v_times[3], 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'Three');
  begin
    perform book_appointment(v_account, v_service, v_dates[4], v_times[4], 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'Four');
    raise exception 'A fourth upcoming booking must fail';
  exception when sqlstate 'HC409' then null; end;
  assert (select count(*) from patients where account_id = v_account) = 1, 'One account has one patient record';

  -- Patient self-cancellation is checked against the owner and recorded.
  insert into reschedule_requests (booking_id, proposed_date, proposed_time)
    values (v_booking.id, v_dates[5], v_times[5]) returning id into v_request;
  begin
    perform cancel_own_appointment(v_booking.id, v_other);
    raise exception 'Another account must not cancel this booking';
  exception when sqlstate 'HC404' then null; end;
  v_cancelled := cancel_own_appointment(v_booking.id, v_account);
  assert v_cancelled.status = 'cancelled', 'The owner can cancel';
  select count(*) into v_events from appointment_status_events
    where booking_id = v_booking.id and next_status = 'cancelled' and actor_account_id = v_account and actor_id is null;
  assert v_events = 1, 'Self-cancellation must be recorded as the patient''s action';
  assert (select status from reschedule_requests where id = v_request) = 'declined', 'The open request closes with the cancellation';
  v_cancelled := cancel_own_appointment(v_booking.id, v_account);
  assert v_cancelled.status = 'cancelled', 'Cancelling twice is not an error';
  -- With one cancelled, the cap frees a seat.
  perform book_appointment(v_account, v_service, v_dates[4], v_times[4], 'Hardening Patient', '09123456789', 'hardening-patient@example.test', 'Four again');

  -- Approving a reschedule needs an active staff actor.
  insert into reschedule_requests (booking_id, proposed_date, proposed_time)
    select id, v_dates[5], v_times[5] from appointments where account_id = v_account and scheduled_date = v_dates[1]
    returning id into v_request;
  begin
    perform approve_reschedule_request(v_request, v_account);
    raise exception 'A patient id must not approve a reschedule';
  exception when sqlstate 'HC400' then null; end;
  perform approve_reschedule_request(v_request, v_admin);
  assert (select status from reschedule_requests where id = v_request) = 'approved', 'An active administrator can approve';

  -- Clinical history cannot be removed by deleting what it hangs off.
  begin
    delete from appointments where id = v_booking.id;
    raise exception 'Deleting a booking with status history must fail';
  exception when foreign_key_violation then null; end;
end;
$$;

-- Clinical tables refuse TRUNCATE unless the database is marked as a demo.
update private.deployment set environment = 'production';
do $$
begin
  begin
    truncate clinical_records;
    raise exception 'TRUNCATE must be refused on a production database';
  exception when raise_exception then
    if sqlerrm not like 'Refusing to truncate%' then raise; end if;
  end;
end;
$$;

select public.assert_rls_posture();
rollback;
