// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with `npm run sync:types`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

import type { AppointmentStatus } from './appointment.js'

/** The four stat tiles across the top of the Dashboard. */
export interface DashboardStats {
  todaysSchedule: number
  /**
   * Bookings *submitted* today, whatever day they are for.
   *
   * Replaced a count of pending requests, which became a permanent zero when
   * bookings started being accepted on submission. Submissions rather than
   * upcoming visits because this is the monitoring number — what arrived while
   * nobody was looking — and upcoming visits would duplicate `todaysSchedule`.
   */
  bookedToday: number
  completedAppointments: number
  inventoryAlerts: number
}

/**
 * One wedge of the Appointments Overview pie chart.
 *
 * `percentage` is carried rather than recomputed because the chart labels it
 * directly ("Completed 41.4%") and the numbers must match the legend exactly.
 */
export interface AppointmentsOverviewSlice {
  status: AppointmentStatus
  count: number
  percentage: number
}

/**
 * One entry in the Urgent Alerts feed.
 *
 * The feed mixes sources — low stock, near expiry, and open reschedule requests
 * all land in the same list, which is why this is a flat shape rather than a
 * union.
 *
 * `booking_review` used to mean "requests awaiting confirmation". Bookings are
 * accepted on submission now, so it points at the reschedule queue instead:
 * that is what is left that a member of staff has to decide.
 */
export type UrgentAlertKind =
  | 'low_stock'
  | 'reorder_level'
  | 'expiring_soon'
  | 'booking_review'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface UrgentAlert {
  id: string
  kind: UrgentAlertKind
  severity: AlertSeverity
  /** Bolded lead-in, e.g. "Mefenamic Acid". */
  subject: string
  /** Rest of the line, e.g. "is critically low — 6 pcs left". */
  message: string
  /** Muted second line, e.g. "Reorder recommended" or "Expires Sep 30, 2026". */
  detail: string
  /** Where clicking the alert should go. */
  href: string
}

/** One notification in the header dropdown. */
export interface AppNotification {
  id: string
  message: string
  occurredAt: string
  read: boolean
}
