-- ---------------------------------------------------------------------------
-- The Dashboard.
--
-- Two derived reads and one writer.
--
-- The reads exist here rather than in Express for the same reason the inventory
-- views do: the Dashboard counts the same things the Booking Requests table and
-- the Low Stock tab count, and two implementations of "below reorder level"
-- would eventually disagree. The stat tile is then wrong in the one place
-- nobody checks against a second source.
--
-- Urgent Alerts are deliberately *not* here. They are derived per request in
-- Express, because an alert is a sentence addressed to a member of staff
-- ("Mefenamic Acid is critically low — 6 pcs left") and that wording belongs
-- with the rest of the UI copy, not in a migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Appointments Overview — the pie chart.
--
-- Grouped in SQL because supabase-js has no GROUP BY: the alternative is
-- selecting every appointment row and counting them in Node, which is the same
-- answer computed over a result set that grows without bound.
--
-- Statuses with no appointments do not appear. The chart draws a wedge per row,
-- and a zero-width wedge with a legend entry reading "Cancelled 0%" is noise.
-- `percentage` is computed in Express against the total, so the legend and the
-- wedges are guaranteed to come from one number.
-- ---------------------------------------------------------------------------
create view appointment_status_counts
with (security_invoker = true)
as
select
  status,
  count(*)::integer as count
from appointments
group by status;

-- ---------------------------------------------------------------------------
-- The four stat tiles.
--
-- clinic_today(), not current_date — Today's Schedule is the clinic's today,
-- and between Manila midnight and UTC midnight those are different days.
--
-- Inventory Alerts is low stock *plus* near expiry, matching the two tabs it
-- links to. Both halves are spelled the way their tab spells them:
--
--   low stock   qty_on_hand < reorder_level, over active medicines
--               (`stock_status <> 'good'` is close but not equal — it also
--               catches a medicine at zero with a reorder level of zero, which
--               the Low Stock tab does not list)
--   near expiry a lot that still holds stock, expiring inside the window or
--               already expired
-- ---------------------------------------------------------------------------
create function dashboard_stats()
returns table (
  todays_schedule integer,
  booking_requests integer,
  completed_appointments integer,
  inventory_alerts integer
)
language sql
stable
as $$
  select
    (
      select count(*) from appointments
      where scheduled_date = clinic_today() and status <> 'cancelled'
    )::integer,
    (select count(*) from appointments where status = 'pending')::integer,
    (select count(*) from appointments where status = 'completed')::integer,
    (
      (
        select count(*) from medicine_stock
        where active and qty_on_hand < reorder_level
      )
      + (
        select count(*) from medicine_batches
        where quantity > 0
          and expires_at <= clinic_today()
            + coalesce(
                (select near_expiry_days from clinic_settings where id = 1), 30
              )
      )
    )::integer;
$$;

-- ---------------------------------------------------------------------------
-- Notifications — the header dropdown.
--
-- Written by trigger rather than by Express, so a notification cannot exist
-- without the event that caused it and cannot be missed by a code path that
-- forgot to write one. Both triggers fire inside the transaction that created
-- the row, which for a booking is inside book_appointment's advisory lock — a
-- booking that loses the capacity race rolls back its notification with it.
--
-- Clinic-wide, matching the table: one bell, one list, addressed to whoever is
-- at the desk.
-- ---------------------------------------------------------------------------

-- "Sep 24", without going through lc_time.
--
-- to_char(d, 'Mon DD') reads the server's locale, so a locale change would
-- silently start writing month names in another language into stored text that
-- is never regenerated. The same reasoning as weekday_of() in the foundations
-- migration, and the same fix.
create function short_date(d date) returns text
language sql
immutable
strict
as $$
  select (array[
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ])[extract(month from d)::int] || ' ' || extract(day from d)::text;
$$;

-- Only patient-submitted requests. A booking with no account behind it was
-- entered by staff at the desk, and telling the desk what the desk just did is
-- how a notification list becomes something nobody reads.
create function notify_booking_submitted() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into notifications (message, href)
  values (
    new.patient_name || ' requested ' || new.service_name
      || ' on ' || short_date(new.scheduled_date) || ', ' || new.slot_time,
    '/admin/appointments'
  );

  return null;
end;
$$;

create trigger appointments_notify_submitted
  after insert on appointments
  for each row
  when (new.account_id is not null and new.status = 'pending')
  execute function notify_booking_submitted();

create function notify_reschedule_requested() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_appointment appointments;
begin
  select * into v_appointment from appointments where id = new.booking_id;

  insert into notifications (message, href)
  values (
    v_appointment.patient_name || ' asked to move their appointment to '
      || short_date(new.proposed_date) || ', ' || new.proposed_time,
    '/admin/appointments'
  );

  return null;
end;
$$;

create trigger reschedule_requests_notify
  after insert on reschedule_requests
  for each row
  execute function notify_reschedule_requested();

-- ---------------------------------------------------------------------------
-- Posture. Every function added by a migration is EXECUTE-able by PUBLIC the
-- moment it is created, and anon inherits that — so the revoke is not optional
-- and has to name `public`, not the roles. See 20260921000010.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

select assert_rls_posture();
