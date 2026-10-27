import type { PostgrestError } from '@supabase/supabase-js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { afterClinicDay } from '../lib/dateRange.js'
import { dbError, unwrapList } from '../lib/db.js'
import { parseQuery } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { APPOINTMENT_STATUSES } from '../contract/appointment.js'
import { DASHBOARD_RANGES } from '../contract/dashboard.js'
import type {
  AppNotification,
  AppointmentsOverviewSlice,
  UrgentAlert,
} from '../contract/dashboard.js'
import { daysBetween, toMedicineListRow } from '../mappers/inventory.js'

/**
 * The Dashboard aggregates every other domain, which is why it was built last.
 *
 * What is computed where is a deliberate split:
 *
 *   in SQL       the counts, because the Bookings tab and the Low Stock tab
 *                count the same things and two implementations would drift
 *   here         the alert sentences, because they are UI copy
 *
 * Nothing on this screen is stored. Record a visit or dispense stock and
 * these numbers move on the next load, with no denormalised counter to go
 * stale.
 */

/** The clinic's "today", not the server's — see clinic_today() in the schema. */
async function clinicToday(): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('clinic_today')
  if (error) throw dbError(error)
  return data
}

async function nearExpiryDays(): Promise<number> {
  const { data } = await getSupabaseClient()
    .from('clinic_settings')
    .select('near_expiry_days')
    .eq('id', 1)
    .maybeSingle()

  return data?.near_expiry_days ?? 30
}

/**
 * Presets resolve in SQL from clinic_today(). Custom ranges carry explicit
 * calendar dates, validated here and interpreted in the clinic timezone.
 *
 * `today` when omitted, which is what the tiles counted before there was a
 * range to choose.
 */
export const rangeQuerySchema = z.object({
  range: z.enum([...DASHBOARD_RANGES, 'custom']).default('today'),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).superRefine((value, context) => {
  if (value.range === 'custom' && (!value.from || !value.to || value.from > value.to)) {
    context.addIssue({ code: 'custom', message: 'Custom range requires valid start and end dates in order.' })
  }
})

async function exactCount(query: PromiseLike<{ count: number | null; error: PostgrestError | null }>): Promise<number> {
  const { count, error } = await query
  if (error) throw dbError(error)
  if (count === null) throw new HttpError(500, 'Appointment count unavailable.')
  return count
}


/**
 * GET /api/dashboard/stats?range=
 *
 * Presets use the existing aggregate RPC. Custom ranges use exact filtered
 * counts so they work without changing the hosted database functions; inventory
 * alerts remain a current-stock count.
 */
export async function getStats(req: Request, res: Response) {
  const { range, from, to } = parseQuery(rangeQuerySchema, req.query)
  const db = getSupabaseClient()
  if (range === 'custom') {
    // Exact HEAD counts avoid PostgREST's row limit and keep submitted dates in Manila.
    const [scheduled, submitted, completed, current] = await Promise.all([
      exactCount(db.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_date', from!).lte('scheduled_date', to!).neq('status', 'cancelled')),
      exactCount(db.from('appointments').select('id', { count: 'exact', head: true }).gte('submitted_at', `${from}T00:00:00+08:00`).lt('submitted_at', afterClinicDay(to!))),
      exactCount(db.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_date', from!).lte('scheduled_date', to!).eq('status', 'completed')),
      db.rpc('dashboard_stats', { p_range: 'today' }),
    ])
    const currentRow = unwrapList(current)[0]
    if (!currentRow) throw new HttpError(500, 'dashboard_stats returned no rows.')
    res.json({ todaysSchedule: scheduled, bookedToday: submitted, completedAppointments: completed, inventoryAlerts: currentRow.inventory_alerts })
    return
  }
  const rows = unwrapList(await db.rpc('dashboard_stats', { p_range: range }))
  const row = rows[0]

  // A function with a single unconditional SELECT always returns a row;
  // reaching this means the function was replaced by one that does not.
  if (!row) throw new HttpError(500, 'dashboard_stats returned no rows.')

  res.json({
    todaysSchedule: row.todays_schedule,
    bookedToday: row.booked_today,
    completedAppointments: row.completed_appointments,
    inventoryAlerts: row.inventory_alerts,
  })
}

/**
 * GET /api/dashboard/appointments-overview?range=
 *
 * `percentage` is carried rather than left to the chart, because the legend
 * prints it as text ("Completed 41.4%") and the wedge is drawn from the same
 * number. One decimal place, matching the design.
 *
 * Ordered by the contract's status order rather than by count, so a wedge does
 * not change colour from one load to the next when two statuses swap rank.
 */
export async function getAppointmentsOverview(req: Request, res: Response) {
  const { range, from, to } = parseQuery(rangeQuerySchema, req.query)
  let counts: Map<string, number>
  if (range === 'custom') {
    const db = getSupabaseClient()
    const pairs = await Promise.all(APPOINTMENT_STATUSES.map(async (status) => [status, await exactCount(
      db.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_date', from!).lte('scheduled_date', to!).in('status', status === 'pending' ? ['pending', 'confirmed'] : [status]),
    )] as const))
    counts = new Map(pairs)
  } else {
    const rows = unwrapList(await getSupabaseClient().rpc('appointment_status_counts', { p_range: range }))
    counts = new Map(rows.map((row) => [row.status, Number(row.count ?? 0)]))
    // Fold legacy accepted bookings into Booked during the migration rollout.
    counts.set('pending', (counts.get('pending') ?? 0) + (counts.get('confirmed') ?? 0))
    counts.delete('confirmed')
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)

  const slices: AppointmentsOverviewSlice[] = APPOINTMENT_STATUSES.filter(
    (status) => (counts.get(status) ?? 0) > 0,
  ).map((status) => {
    const count = counts.get(status) ?? 0
    return {
      status,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }
  })

  res.json(slices)
}

/**
 * GET /api/dashboard/alerts
 *
 * Derived on every request, never stored. An alert is a statement about the
 * clinic *right now* — a medicine is low until someone restocks it — so a table
 * of alert rows would need invalidating from every write path that could
 * resolve one, and the one that got missed would leave a red banner up for a
 * problem already fixed.
 *
 * The three sources are read together and sorted by severity, because the feed
 * is a fixed-height panel and what it cuts off has to be the least urgent thing.
 */
export async function getUrgentAlerts(_req: Request, res: Response) {
  const db = getSupabaseClient()
  const [today, window] = await Promise.all([clinicToday(), nearExpiryDays()])

  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() + window)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  const [medicines, batches, reschedules] = await Promise.all([
    db
      .from('medicine_stock')
      .select('*')
      .eq('active', true)
      .order('generic_name'),
    db
      .from('medicine_batches')
      .select('*, medicines(generic_name)')
      .gt('quantity', 0)
      .lte('expires_at', cutoffDate)
      .order('expires_at'),
    // Open reschedule requests — note this is `reschedule_request_status`, a
    // different enum from the appointment one. This `pending` is still real.
    db
      .from('reschedule_requests')
      .select('requested_at', { count: 'exact' })
      .eq('status', 'pending')
      .order('requested_at')
      .limit(1),
  ])

  const alerts: UrgentAlert[] = []

  for (const medicine of unwrapList(medicines)
    .map(toMedicineListRow)
    .filter((m) => m.qtyOnHand < m.reorderLevel)) {
    // "Critically low" is a harder signal than "below reorder level" — the
    // design distinguishes the two, and only the first is red.
    const critical = medicine.qtyOnHand < medicine.reorderLevel / 2

    alerts.push({
      id: `alert-stock-${medicine.id}`,
      kind: critical ? 'low_stock' : 'reorder_level',
      severity: critical ? 'critical' : 'warning',
      subject: medicine.genericName,
      message: critical
        ? `is critically low — ${medicine.qtyOnHand} ${medicine.unit} left`
        : `is below reorder level`,
      detail: critical
        ? 'Reorder recommended'
        : `${medicine.qtyOnHand} ${medicine.unit} left · reorder at ${medicine.reorderLevel}`,
      href: '/admin/inventory?tab=low-stock',
    })
  }

  for (const batch of unwrapList(batches)) {
    const daysLeft = daysBetween(today, batch.expires_at)

    alerts.push({
      id: `alert-expiry-${batch.id}`,
      kind: 'expiring_soon',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      subject: batch.medicines?.generic_name ?? 'Unknown medicine',
      // Already-expired lots come through this query too, and "expiring in -3
      // days" is not a sentence. They are the more urgent of the two.
      message:
        daysLeft < 0
          ? `batch ${batch.batch_no} expired ${-daysLeft} days ago`
          : `batch ${batch.batch_no} expiring in ${daysLeft} days`,
      detail: `Expires ${batch.expires_at}`,
      href: '/admin/inventory?tab=expiring',
    })
  }

  if (reschedules.error) throw dbError(reschedules.error)

  /**
   * Open reschedule requests.
   *
   * This slot used to hold "N booking requests awaiting review". Bookings are
   * accepted on submission now, so that alert could never fire again — but the
   * reschedule queue inherited the problem it was solving: it is the one thing
   * left that waits on a human, and it had no presence on the Dashboard at all.
   * A queue nobody opens is a queue nobody works, and the patient is the one
   * who sits waiting on a decision that was never seen.
   */
  const openCount = reschedules.count ?? 0
  if (openCount > 0) {
    const oldest = reschedules.data?.[0]?.requested_at

    alerts.push({
      id: 'alert-reschedules',
      kind: 'booking_review',
      severity: 'info',
      subject: `${openCount} reschedule request${openCount === 1 ? '' : 's'}`,
      message: 'awaiting approval',
      detail: oldest ? `Oldest asked ${sinceLabel(oldest, today)}` : '',
      href: '/admin/appointments?tab=reschedules',
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  res.json(alerts)
}

/**
 * "2 days ago", against the clinic's calendar rather than the server's clock.
 *
 * Something that happened at 23:00 Manila is "yesterday" to staff who see it at
 * 09:00 the next morning only if the comparison is made in calendar days in the
 * clinic's own timezone — which is the whole reason clinic_today() exists.
 */
function sinceLabel(occurredAt: string, today: string): string {
  // Read the instant in Manila before taking its date. Slicing the ISO string
  // takes the *UTC* date, which is a day behind the clinic from midnight to
  // 8 AM local — so a request made at 07:55 read "yesterday".
  const occurredOn = new Date(occurredAt).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila',
  })
  const days = daysBetween(occurredOn, today)

  // A clock-skewed device can put an event slightly ahead of the clinic's
  // today. That should read "today", never "-2 days ago".
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * GET /api/notifications
 *
 * The header dropdown. Distinct from Urgent Alerts above: these are events that
 * happened and stay in the list once handled, written by trigger at the moment
 * they occur, where an alert is a condition that disappears when it is fixed.
 *
 * Capped rather than paged — the panel scrolls to a fixed height and has no
 * "load more".
 */
export async function listNotifications(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('notifications')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(30),
  )

  const notifications: AppNotification[] = rows.map((row) => ({
    id: row.id,
    message: row.message,
    occurredAt: row.occurred_at,
    read: row.read,
  }))

  res.json(notifications)
}
