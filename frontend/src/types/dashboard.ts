import type { AppointmentStatus } from './appointment'

/** The four stat tiles across the top of the Dashboard. */
export interface DashboardStats {
  todaysSchedule: number
  bookingRequests: number
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
 * The feed mixes sources — low stock, near expiry, and pending bookings all land
 * in the same list, which is why this is a flat shape rather than a union.
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
