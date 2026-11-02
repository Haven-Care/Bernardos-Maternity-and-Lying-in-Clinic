-- ---------------------------------------------------------------------------
-- Run purge_expired_notifications() every night instead of by hand.
--
-- Daily rather than monthly, so a notification is gone within a day of
-- clinic_settings.notification_retention_days, not up to a month after it.
-- pg_cron keeps time in UTC: 19:00 UTC is 03:00 in Manila, outside clinic
-- hours.
--
-- Supabase ships pg_cron, hosted and local. Where it is not installed, as in
-- the PGlite run of `npm run db:check`, nothing is scheduled and the migration
-- still applies.
-- ---------------------------------------------------------------------------

begin;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available; the notification purge is not scheduled.';
    return;
  end if;

  -- As Supabase documents it: the extension in pg_catalog, and the job tables
  -- readable by postgres, which owns this project's migrations.
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;

  -- Scheduling under an existing name replaces that job, so a re-run is safe.
  perform cron.schedule(
    'purge-expired-notifications',
    '0 19 * * *',
    'select public.purge_expired_notifications()'
  );
end;
$$;

commit;
