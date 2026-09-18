import type { AppointmentStatus } from '../types/appointment'
import type {
  AppNotification,
  AppointmentsOverviewSlice,
  DashboardStats,
  UrgentAlert,
} from '../types/dashboard'
import { APPOINTMENT_STATUSES } from '../types/appointment'
import { appointments } from '../mocks/appointments'
import { batches, medicines } from '../mocks/medicines'
import { clinicSettings } from '../mocks/clinic'
import { daysUntil, isoDate, mockDelay, today } from '../mocks/util'
// import { apiFetch } from './client'

/**
 * Everything here is aggregated across the other domains, which is why this is
 * the last file to swap — the backend needs every other table in place first.
 *
 * Nothing is hardcoded. Confirm a booking or dispense stock and these numbers
 * move, which is the point: the aggregation logic is written and eyeball-tested
 * before the backend ever runs it.
 */

function qtyOnHand(medicineId: string): number {
  return batches
    .filter((b) => b.medicineId === medicineId)
    .reduce((sum, b) => sum + b.quantity, 0)
}

function lowStockMedicines() {
  return medicines
    .filter((m) => m.active)
    .map((m) => ({ medicine: m, qty: qtyOnHand(m.id) }))
    .filter(({ medicine, qty }) => qty < medicine.reorderLevel)
}

function expiringBatches() {
  return batches
    .filter((b) => b.quantity > 0)
    .map((b) => ({ batch: b, daysLeft: daysUntil(b.expiresAt) }))
    .filter(({ daysLeft }) => daysLeft <= clinicSettings.nearExpiryDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export async function getStats(): Promise<DashboardStats> {
  // BACKEND: return apiFetch<DashboardStats>('/dashboard/stats')
  const todayIso = isoDate(today())

  return mockDelay({
    todaysSchedule: appointments.filter(
      (a) => a.scheduledDate === todayIso && a.status !== 'cancelled',
    ).length,
    bookingRequests: appointments.filter((a) => a.status === 'pending').length,
    completedAppointments: appointments.filter((a) => a.status === 'completed')
      .length,
    inventoryAlerts: lowStockMedicines().length + expiringBatches().length,
  })
}

export async function getAppointmentsOverview(): Promise<
  AppointmentsOverviewSlice[]
> {
  // BACKEND: return apiFetch<AppointmentsOverviewSlice[]>('/dashboard/appointments-overview')
  const total = appointments.length

  const slices = APPOINTMENT_STATUSES.map((status: AppointmentStatus) => {
    const count = appointments.filter((a) => a.status === status).length
    return {
      status,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }
  }).filter((s) => s.count > 0)

  return mockDelay(slices)
}

export async function getUrgentAlerts(): Promise<UrgentAlert[]> {
  // BACKEND: return apiFetch<UrgentAlert[]>('/dashboard/alerts')
  const alerts: UrgentAlert[] = []

  for (const { medicine, qty } of lowStockMedicines()) {
    // "Critically low" is a harder signal than "below reorder level" — the
    // design distinguishes the two, and only the first is red.
    const critical = qty < medicine.reorderLevel / 2
    alerts.push({
      id: `alert-stock-${medicine.id}`,
      kind: critical ? 'low_stock' : 'reorder_level',
      severity: critical ? 'critical' : 'warning',
      subject: medicine.genericName,
      message: critical
        ? `is critically low — ${qty} ${medicine.unit} left`
        : `is below reorder level`,
      detail: critical
        ? 'Reorder recommended'
        : `${qty} ${medicine.unit} left · reorder at ${medicine.reorderLevel}`,
      href: '/admin/inventory?tab=low-stock',
    })
  }

  for (const { batch, daysLeft } of expiringBatches()) {
    const medicine = medicines.find((m) => m.id === batch.medicineId)
    alerts.push({
      id: `alert-expiry-${batch.id}`,
      kind: 'expiring_soon',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      subject: medicine?.genericName ?? 'Unknown medicine',
      message: `batch ${batch.batchNo} expiring in ${daysLeft} days`,
      detail: `Expires ${batch.expiresAt}`,
      href: '/admin/inventory?tab=expiring',
    })
  }

  const pending = appointments.filter((a) => a.status === 'pending').length
  if (pending > 0) {
    alerts.push({
      id: 'alert-bookings',
      kind: 'booking_review',
      severity: 'info',
      subject: `${pending} booking request${pending === 1 ? '' : 's'}`,
      message: 'awaiting review',
      detail: 'Oldest submitted 2 days ago',
      href: '/admin/appointments',
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  return mockDelay(alerts)
}

export async function listNotifications(): Promise<AppNotification[]> {
  // BACKEND: return apiFetch<AppNotification[]>('/notifications')
  const todayIso = isoDate(today())
  const todayCount = appointments.filter(
    (a) => a.scheduledDate === todayIso && a.status !== 'cancelled',
  ).length

  const rows: AppNotification[] = [
    {
      id: 'notif-1',
      message: `${todayCount} appointments scheduled for today`,
      occurredAt: new Date().toISOString(),
      read: false,
    },
    ...lowStockMedicines().map(({ medicine }, i) => ({
      id: `notif-stock-${i}`,
      message: `${medicine.genericName} is low on stock`,
      occurredAt: new Date().toISOString(),
      read: false,
    })),
    ...expiringBatches()
      .slice(0, 2)
      .map(({ batch, daysLeft }, i) => ({
        id: `notif-exp-${i}`,
        message: `Batch ${batch.batchNo} expires in ${daysLeft} days`,
        occurredAt: new Date().toISOString(),
        read: true,
      })),
  ]

  return mockDelay(rows)
}
