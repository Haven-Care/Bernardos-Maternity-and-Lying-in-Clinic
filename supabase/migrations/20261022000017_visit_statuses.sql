-- Commit new enum values before functions use them in the next migration.
alter type public.appointment_status add value if not exists 'arrived';
alter type public.appointment_status add value if not exists 'no_show';
