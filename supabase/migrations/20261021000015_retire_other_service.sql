-- Preserve historical service references; stop accepting new generic bookings.
update public.services
set active = false
where lower(trim(name)) = 'other';
