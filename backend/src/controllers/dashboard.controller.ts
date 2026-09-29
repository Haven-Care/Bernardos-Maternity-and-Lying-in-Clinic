import type { Request, Response } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrapList } from '../lib/db.js'
import { HttpError } from '../middleware/errorHandler.js'
import { APPOINTMENT_STATUSES } from '../contract/appointment.js'
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
 *   in SQL       the counts, because the Booking Requests tab and the Low Stock
 *                tab count the same things and two implementations would drift
 *   here         the alert sentences, because they are UI copy
 *
 * Nothing on this screen is stored. Confirm a booking or dispense stock and
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
 * GET /api/dashboard/stats
 *
 * One round trip. The four tiles are four counts over three tables, and pulling
 * them apart into separate queries would let them disagree with each other
 * across a booking that lands between two of them.
 */
export async function getStats(_req: Request, res: Response) {
  const rows = unwrapList(await getSupabaseClient().rpc('dashboard_stats'))
  const row = rows[0]

  // A function with a single unconditional SELECT always returns a row;
  // reaching this means the function was replaced by one that does not.
  if (!row) throw new HttpError(500, 'dashboard_stats returned no rows.')

  res.json({
    todaysSchedule: row.todays_schedule,
    bookingRequests: row.booking_requests,
    completedAppointments: row.completed_appointments,
    inventoryAlerts: row.inventory_alerts,
  })
}

/**
 * GET /api/dashboard/appointments-overview
 *
 * `percentage` is carried rather than left to the chart, because the legend
 * prints it as text ("Completed 41.4%") and the wedge is drawn from the same
 * number. One decimal place, matching the design.
 *
 * Ordered by the contract's status order rather than by count, so a wedge does
 * not change colour from one load to the next when two statuses swap rank.
 */
export async function getAppointmentsOverview(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient().from('appointment_status_counts').select('*'),
  )

  const counts = new Map(rows.map((r) => [r.status, Number(r.count ?? 0)]))
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

  const [medicines, batches, pending] = await Promise.all([
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
    db
      .from('appointments')
      .select('submitted_at', { count: 'exact' })
      .eq('status', 'pending')
      .order('submitted_at')
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

  if (pending.error) throw dbError(pending.error)

  const pendingCount = pending.count ?? 0
  if (pendingCount > 0) {
    const oldest = pending.data?.[0]?.submitted_at

    alerts.push({
      id: 'alert-bookings',
      kind: 'booking_review',
      severity: 'info',
      subject: `${pendingCount} booking request${pendingCount === 1 ? '' : 's'}`,
      message: 'awaiting review',
      detail: oldest ? `Oldest submitted ${sinceLabel(oldest, today)}` : '',
      href: '/admin/appointments',
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  res.json(alerts)
}

/**
 * "2 days ago", against the clinic's calendar rather than the server's clock.
 *
 * A request submitted at 23:00 Manila is "today" to staff who see it at 09:00
 * the next morning only if the comparison is made in calendar days in the
 * clinic's own timezone — which is the whole reason clinic_today() exists.
 */
function sinceLabel(submittedAt: string, today: string): string {
  const days = daysBetween(submittedAt.slice(0, 10), today)

  // Seeded requests can carry a submitted_at ahead of today; so can a booking
  // made from a device with a skewed clock. Neither should render "-2 days ago".
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
