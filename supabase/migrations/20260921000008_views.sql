-- ---------------------------------------------------------------------------
-- Derived reads.
--
-- These are transcriptions of the TypeScript in frontend/src/api/inventory.ts
-- and patients.ts, which computed the same values over fixtures. That code was
-- deliberately written in the api layer rather than in components so that this
-- migration could replace it wholesale — the components never learn it moved.
-- ---------------------------------------------------------------------------

-- `security_invoker = true` on both views below is load-bearing, not decoration.
--
-- A Postgres view runs with its *owner's* privileges by default. These are
-- created by a migration, so the owner is the superuser — meaning the anon key
-- could select from `patient_list` and read every medical record in the clinic,
-- with row level security on the underlying table silently not applying. Making
-- the views invoker-rights is what closes that, and it is the one setting that
-- would make the deny-all posture a lie if it were left off.

-- One row per medicine, with stock rolled up from its batches.
-- Backs the Medicine List tab, the Low Stock tab and the inventory stat tiles.
create view medicine_stock
with (security_invoker = true)
as
select
  m.*,
  coalesce(b.qty_on_hand, 0) as qty_on_hand,
  b.nearest_expiry,
  case
    when coalesce(b.qty_on_hand, 0) <= 0 then 'out'
    when coalesce(b.qty_on_hand, 0) < m.reorder_level then 'low'
    else 'good'
  end::stock_status as stock_status
from medicines m
left join lateral (
  select
    sum(quantity) as qty_on_hand,
    -- Soonest expiry among lots that still hold stock. An empty expired batch
    -- is not what the clinic needs warning about.
    min(expires_at) filter (where quantity > 0) as nearest_expiry
  from medicine_batches
  where medicine_id = m.id
) b on true;

-- One row per patient for the Patient Records table.
-- `last_visit` is derived, never stored: it is a fact about appointments.
create view patient_list
with (security_invoker = true)
as
select
  p.*,
  v.last_visit
from patients p
left join lateral (
  select max(scheduled_date) as last_visit
  from appointments
  where patient_id = p.id
    and status = 'completed'
) v on true;

-- ---------------------------------------------------------------------------
-- Slot availability for a given date.
--
-- A function rather than a view because it is parameterised by date, and the
-- booking form asks it one date at a time.
--
-- Cancelled bookings free their seat; every other status holds it, including
-- pending. A request that staff have not reviewed yet still occupies the slot,
-- otherwise the clinic could confirm more people than the room holds.
-- ---------------------------------------------------------------------------
-- `slot_time text`, not `clock_time`, even though the column is the domain.
-- `supabase gen types` renders a domain in a function's RETURNS TABLE as
-- `unknown`, which forces a cast at every call site. The domain exists to
-- validate what gets *stored*; these values were validated on the way in.
create function slot_availability(target_date date)
returns table (
  id uuid,
  weekday weekday,
  slot_time text,
  capacity integer,
  is_open boolean,
  booked integer,
  available boolean
)
language sql
stable
as $$
  select
    s.id,
    s.weekday,
    s.slot_time,
    s.capacity,
    s.is_open,
    coalesce(a.booked, 0)::integer as booked,
    (s.is_open and coalesce(a.booked, 0) < s.capacity) as available
  from appointment_slots s
  left join lateral (
    select count(*)::integer as booked
    from appointments
    where scheduled_date = target_date
      and appointments.slot_time = s.slot_time
      and status <> 'cancelled'
  ) a on true
  where s.weekday = weekday_of(target_date)
  order by s.slot_time;
$$;
