import type {
  AppNotification,
  AppointmentsOverviewSlice,
  DashboardRange,
  DashboardDateRange,
  DashboardStats,
  UrgentAlert,
} from '../types/dashboard'
import { apiFetch } from './client'

/**
 * Everything here is aggregated across the other domains, which is why this was
 * the last file to swap — the backend needed every other table in place first.
 *
 * Nothing on this screen is stored or cached. Confirm a booking or dispense
 * stock and these numbers move on the next load.
 */

/**
 * Presets use the clinic clock. Custom ranges send explicit start/end dates,
 * and both endpoints interpret them in the clinic timezone.
 */
export async function getStats(range: DashboardRange, dates?: DashboardDateRange): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/dashboard/stats?${rangeQuery(range, dates)}`)
}

export async function getAppointmentsOverview(
  range: DashboardRange,
  dates?: DashboardDateRange,
): Promise<AppointmentsOverviewSlice[]> {
  return apiFetch<AppointmentsOverviewSlice[]>(
    `/dashboard/appointments-overview?${rangeQuery(range, dates)}`,
  )
}

/**
 * Low stock, near expiry and open reschedule requests, in one severity-ordered
 * feed.
 *
 * Derived per request rather than read from a table: an alert is a condition
 * that stops being true the moment someone restocks the medicine, and a stored
 * row would have to be invalidated from every write path that could resolve it.
 */
export async function getUrgentAlerts(): Promise<UrgentAlert[]> {
  return apiFetch<UrgentAlert[]>('/dashboard/alerts')
}

/** The header dropdown. Events that happened, not conditions that hold. */
export async function listNotifications(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>('/notifications')
}

function rangeQuery(range: DashboardRange, dates?: DashboardDateRange): string {
  const query = new URLSearchParams({ range })
  if (range === 'custom' && dates) { query.set('from', dates.from); query.set('to', dates.to) }
  return query.toString()
}
