import { describe, expect, it } from 'vitest'
import * as dashboard from './dashboard'
import * as appointmentsApi from './appointments'
import { appointments } from '../mocks/appointments'
import { isoDate, today } from '../mocks/util'

/**
 * The dashboard aggregates across every other domain, so these double as a check
 * that the fixtures are internally consistent — a pie chart that doesn't sum to
 * 100% or a stat tile that ignores cancellations would both show up here.
 */

describe('stats', () => {
  it('counts pending requests as booking requests', async () => {
    const stats = await dashboard.getStats()
    const pending = appointments.filter((a) => a.status === 'pending').length

    expect(stats.bookingRequests).toBe(pending)
  })

  it('excludes cancelled bookings from today’s schedule', async () => {
    const before = await dashboard.getStats()

    // Local-time formatting, not toISOString — see the note on isoDate.
    const todayIso = isoDate(today())
    const target = appointments.find(
      (a) => a.scheduledDate === todayIso && a.status === 'confirmed',
    )

    // Guard: the fixture generator should always place confirmed bookings today.
    expect(target).toBeDefined()

    await appointmentsApi.cancelBooking(target!.id)
    const after = await dashboard.getStats()

    expect(after.todaysSchedule).toBe(before.todaysSchedule - 1)
  })
})

describe('appointments overview', () => {
  it('sums to 100% across the statuses present', async () => {
    const slices = await dashboard.getAppointmentsOverview()
    const total = slices.reduce((sum, s) => sum + s.percentage, 0)

    // Percentages are rounded to one decimal for the chart labels, so allow
    // rounding drift rather than demanding an exact 100.
    expect(total).toBeGreaterThan(99)
    expect(total).toBeLessThan(101)
  })

  it('counts every appointment exactly once', async () => {
    const slices = await dashboard.getAppointmentsOverview()
    const counted = slices.reduce((sum, s) => sum + s.count, 0)

    expect(counted).toBe(appointments.length)
  })

  it('omits statuses with no appointments rather than drawing empty wedges', async () => {
    const slices = await dashboard.getAppointmentsOverview()

    for (const slice of slices) {
      expect(slice.count).toBeGreaterThan(0)
    }
  })
})

describe('urgent alerts', () => {
  it('surfaces low stock, expiry, and pending bookings in one feed', async () => {
    const alerts = await dashboard.getUrgentAlerts()
    const kinds = new Set(alerts.map((a) => a.kind))

    expect(kinds.has('booking_review')).toBe(true)
    expect(
      kinds.has('low_stock') || kinds.has('reorder_level'),
    ).toBe(true)
    expect(kinds.has('expiring_soon')).toBe(true)
  })

  it('orders critical before warning before info', async () => {
    const alerts = await dashboard.getUrgentAlerts()
    const rank = { critical: 0, warning: 1, info: 2 }
    const ranks = alerts.map((a) => rank[a.severity])

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })
})
