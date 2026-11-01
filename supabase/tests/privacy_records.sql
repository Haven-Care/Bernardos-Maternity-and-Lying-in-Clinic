-- Run only against a disposable migrated/seeded development database.
-- Auth users and records are synthetic; the transaction is rolled back.
begin;
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444441', 'privacy-patient@example.test', '{}', '{"full_name":"Privacy Patient"}'),
  ('44444444-4444-4444-8444-444444444442', 'privacy-admin@example.test', '{"user_type":"staff","staff_role":"administrator"}', '{"full_name":"Privacy Admin"}');

do $$
declare
  v_patient uuid := '44444444-4444-4444-8444-444444444441';
  v_admin uuid := '44444444-4444-4444-8444-444444444442';
  v_consent uuid;
  v_request uuid;
  v_purged integer;
begin
  -- Browser keys reach none of the new tables.
  assert not has_table_privilege('anon', 'public.patient_consents', 'SELECT'), 'anon must not read consents';
  assert not has_table_privilege('authenticated', 'public.audit_log', 'SELECT'), 'authenticated must not read the audit log';
  assert not has_table_privilege('anon', 'public.privacy_requests', 'INSERT'), 'anon must not file requests directly';

  -- Consent is a record: one per version, never edited.
  insert into patient_consents (account_id, notice_version, channel)
    values (v_patient, 'test-1', 'sign_up') returning id into v_consent;
  begin
    insert into patient_consents (account_id, notice_version, channel) values (v_patient, 'test-1', 'in_app');
    raise exception 'A second consent for the same version must fail';
  exception when unique_violation then null; end;
  begin
    update patient_consents set notice_version = 'test-2' where id = v_consent;
    raise exception 'Editing a consent must fail';
  exception when sqlstate 'HC409' then null; end;
  begin
    delete from patient_consents where id = v_consent;
    raise exception 'Deleting a consent must fail';
  exception when sqlstate 'HC409' then null; end;

  -- The audit log is append-only.
  insert into audit_log (actor_id, actor_role, action, patient_id, details)
    values (v_admin, 'administrator', 'patient.view', null, '{"fields":["allergies"]}');
  begin
    update audit_log set action = 'patient.list';
    raise exception 'Editing the audit log must fail';
  exception when sqlstate 'HC409' then null; end;
  begin
    delete from audit_log;
    raise exception 'Deleting from the audit log must fail';
  exception when sqlstate 'HC409' then null; end;
  begin
    insert into audit_log (actor_role, action) values ('administrator', 'Patient View');
    raise exception 'Malformed action names must fail';
  exception when check_violation then null; end;

  -- A resolved request needs a resolver, a time and a note.
  insert into privacy_requests (account_id, kind, details)
    values (v_patient, 'access', 'Please send me my records.') returning id into v_request;
  begin
    update privacy_requests set resolved_at = now() where id = v_request;
    raise exception 'Resolving without a note must fail';
  exception when check_violation then null; end;
  update privacy_requests set resolved_at = now(), resolved_by = v_admin, resolution_note = 'Sent by email.' where id = v_request;

  -- An account can be deleted; its consent and request stay, unlinked.
  delete from auth.users where id = v_patient;
  assert (select account_id from patient_consents where id = v_consent) is null, 'Consent outlives the account';
  assert (select count(*) from privacy_requests where id = v_request) = 1, 'Request outlives the account';

  -- Retention removes only notifications past the clinic's period.
  insert into notifications (message, occurred_at) values
    ('old synthetic notification', now() - interval '400 days'),
    ('recent synthetic notification', now() - interval '10 days');
  v_purged := purge_expired_notifications();
  assert v_purged >= 1, 'Old notifications are purged';
  assert exists (select 1 from notifications where message = 'recent synthetic notification'), 'Recent notifications stay';
  assert not exists (select 1 from notifications where message = 'old synthetic notification'), 'Old notifications go';
end;
$$;

update private.deployment set environment = 'production';
do $$
begin
  begin
    truncate audit_log;
    raise exception 'TRUNCATE of the audit log must be refused outside a demo';
  exception when raise_exception then
    if sqlerrm not like 'Refusing to truncate%' then raise; end if;
  end;
end;
$$;

select public.assert_rls_posture();
rollback;
