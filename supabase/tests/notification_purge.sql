-- Run only against a disposable migrated/seeded development database.
-- Checks the nightly purge job. It skips only where pg_cron cannot be installed
-- at all, as in PGlite, which is the same test migration 28 uses. On a Supabase
-- stack (local, CI or hosted) a missing or changed job fails.
begin;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available; skipping the purge schedule check.';
    return;
  end if;

  assert to_regnamespace('cron') is not null,
    'pg_cron is available, so migration 28 installed it';

  assert (select count(*) from cron.job
          where jobname = 'purge-expired-notifications'
            and schedule = '0 19 * * *'
            and command = 'select public.purge_expired_notifications()'
            and active) = 1,
    'The nightly notification purge is scheduled once, and active';
end;
$$;

rollback;
