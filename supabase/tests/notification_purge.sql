-- Run only against a disposable migrated/seeded development database.
-- Checks the nightly purge job where pg_cron is installed (a local stack, and
-- the CI integration job). Without it, as in PGlite, there is no job to check.
begin;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron is not installed; skipping the purge schedule check.';
    return;
  end if;

  assert (select count(*) from cron.job
          where jobname = 'purge-expired-notifications'
            and schedule = '0 19 * * *'
            and command = 'select public.purge_expired_notifications()'
            and active) = 1,
    'The nightly notification purge is scheduled once, and active';
end;
$$;

rollback;
