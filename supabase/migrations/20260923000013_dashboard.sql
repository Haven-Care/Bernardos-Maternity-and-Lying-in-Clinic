-- ---------------------------------------------------------------------------
-- The Dashboard.
--
-- Two derived reads over a shared date range, and one writer.
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
-- The Dashboard's date range.
--
-- One key in, two dates out, in the clinic's calendar. The stat tiles and the
-- pie both resolve their range through this, so they cannot disagree about
-- where "last month" starts. Inventory Alerts ignores it: stock is a fact about
-- now, whatever range is on screen.
--
-- Resolved here from clinic_today() rather than sent as dates by the browser. A
-- laptop with the wrong clock or timezone would otherwise move "today" for
-- everything the Dashboard counts.
--
--   today         today
--   yesterday     the day before
--   last-7-days   today and the six days before it
--   this-month    the whole calendar month, so Scheduled includes the visits
--                 still to come this month
--   last-month    the whole previous calendar month
--   all-time      -infinity to infinity, so every caller filters with a plain
--                 BETWEEN instead of special-casing nulls
-- ---------------------------------------------------------------------------
create function dashboard_range(p_range text, out from_date date, out to_date date)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_today date := clinic_today();
  v_month_start date := make_date(
    extract(year from v_today)::int, extract(month from v_today)::int, 1
  );
begin
  case p_range
    when 'today' then
      from_date := v_today;
      to_date := v_today;
    when 'yesterday' then
      from_date := v_today - 1;
      to_date := v_today - 1;
    when 'last-7-days' then
      from_date := v_today - 6;
      to_date := v_today;
    when 'this-month' then
      from_date := v_month_start;
      to_date := (v_month_start + interval '1 month')::date - 1;
    when 'last-month' then
      from_date := (v_month_start - interval '1 month')::date;
      to_date := v_month_start - 1;
    when 'all-time' then
      from_date := '-infinity';
      to_date := 'infinity';
    else
      -- Express validates the key first, so reaching this is a caller that
      -- skipped it. Counting zero would look like a quiet day; say so instead.
      raise exception 'Unknown dashboard range: %', p_range
        using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Appointments Overview — the pie chart.
--
-- Grouped in SQL because supabase-js has no GROUP BY: the alternative is
-- selecting every appointment row and counting them in Node, which is the same
-- answer computed over a result set that grows without bound.
--
-- Appointments are placed in the range by the day of the visit, the same as
-- Scheduled and Completed on the tiles above it.
--
-- Statuses with no appointments do not appear. The chart draws a wedge per row,
-- and a zero-width wedge with a legend entry reading "Cancelled 0%" is noise.
-- `percentage` is computed in Express against the total, so the legend and the
-- wedges are guaranteed to come from one number.
-- ---------------------------------------------------------------------------
create function appointment_status_counts(p_range text)
returns table (status appointment_status, count integer)
language sql
stable
as $$
  select a.status, count(*)::integer
  from appointments a, dashboard_range(p_range) r
  where a.scheduled_date between r.from_date and r.to_date
  group by a.status;
$$;

-- ---------------------------------------------------------------------------
-- The four stat tiles.
--
-- Over the range from dashboard_range(), which is built on clinic_today(), not
-- current_date — between Manila midnight and UTC midnight those are different
-- days.
--
-- Scheduled (todays_schedule) counts visits in the range, cancelled ones left
-- out: the tile answers "who is coming in", and someone who cancelled is not.
--
-- Booked (booked_today) counts *submissions* in the range — bookings that
-- arrived then, whatever day they are for. It replaced a count of pending
-- requests, which became a permanent zero when bookings started being accepted
-- on submission. Submissions rather than visits because this tile answers the
-- question staff actually have now that nothing waits for them: what came in
-- while I wasn't looking. Visits would duplicate the tile to its left.
--
-- Completed counts completed visits in the range, placed by the visit's day.
--
-- The column names still say "today" because that is the default range and
-- the contract's field names; the range, not the name, decides what they count.
--
-- Inventory Alerts is low stock *plus* near expiry, matching the two tabs it
-- links to, and is always as of now. Both halves are spelled the way their tab
-- spells them:
--
--   low stock   qty_on_hand < reorder_level, over active medicines
--               (`stock_status <> 'good'` is close but not equal — it also
--               catches a medicine at zero with a reorder level of zero, which
--               the Low Stock tab does not list)
--   near expiry a lot that still holds stock, expiring inside the window or
--               already expired
-- ---------------------------------------------------------------------------
create function dashboard_stats(p_range text)
returns table (
  todays_schedule integer,
  booked_today integer,
  completed_appointments integer,
  inventory_alerts integer
)
language sql
stable
as $$
  select
    (
      select count(*) from appointments
      where scheduled_date between r.from_date and r.to_date
        and status <> 'cancelled'
    )::integer,
    (
      select count(*) from appointments
      -- submitted_at is a timestamptz and the clinic is UTC+8, so it has to be
      -- read in Manila before its date is taken. Comparing the raw UTC date
      -- would move the day's cutoff to 8 AM local.
      where (submitted_at at time zone 'Asia/Manila')::date
        between r.from_date and r.to_date
    )::integer,
    (
      select count(*) from appointments
      where status = 'completed'
        and scheduled_date between r.from_date and r.to_date
    )::integer,
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
    )::integer
  from dashboard_range(p_range) r;
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

-- Only patient-submitted bookings. One with no account behind it was entered by
-- staff at the desk, and telling the desk what the desk just did is how a
-- notification list becomes something nobody reads.
--
-- This is the whole of the clinic's awareness now. While bookings waited for
-- confirmation the queue itself was the notice, and the bell was a convenience;
-- with nothing queued, a booking that writes no notification is a booking the
-- clinic never hears about until the patient walks in.
create function notify_booking_submitted() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into notifications (message, href)
  values (
    new.patient_name || ' booked ' || new.service_name
      || ' on ' || short_date(new.scheduled_date) || ', ' || new.slot_time,
    '/admin/appointments'
  );

  return null;
end;
$$;

-- No status clause. It used to read `and new.status = 'pending'`, which stopped
-- matching anything the moment bookings began arriving confirmed — and a
-- trigger that silently never fires is the worst possible failure for the one
-- mechanism telling the clinic a patient is coming.
create trigger appointments_notify_submitted
  after insert on appointments
  for each row
  when (new.account_id is not null)
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
