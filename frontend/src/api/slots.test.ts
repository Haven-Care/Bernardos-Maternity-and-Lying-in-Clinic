import { describe, expect, it } from 'vitest'
import * as slotsApi from './slots'
import { appointments } from '../mocks/appointments'
import { slots } from '../mocks/slots'

/**
 * Capacity is the product's headline scheduling promise — "admin-defined time
 * slots, daily capacity limits, no double-booking". These guard both the
 * availability calculation and the seed data, because a demo calendar showing
 * two patients in a one-patient slot contradicts the pitch on sight.
 */

describe('seeded bookings', () => {
  it('never exceed a slot’s capacity', () => {
    const counts = new Map<string, number>()

    for (const booking of appointments) {
      if (booking.status === 'cancelled') continue
      const key = `${booking.scheduledDate}|${booking.slotTime}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const WEEKDAY_BY_INDEX = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const

    const overbooked: string[] = []
    let checked = 0

    for (const [key, count] of counts) {
      const [date, time] = key.split('|')
      const weekday = WEEKDAY_BY_INDEX[new Date(`${date}T00:00:00`).getDay()]
      const slot = slots.find((s) => s.time === time && s.weekday === weekday)

      // Every seeded booking must land on a configured slot; if it doesn't,
      // that's its own bug and the capacity check below would skip it silently.
      expect(slot, `no slot configured for ${weekday} ${time}`).toBeDefined()
      checked += 1

      if (count > slot!.capacity) {
        overbooked.push(`${key} — ${count} booked, capacity ${slot!.capacity}`)
      }
    }

    // Guards against the assertion passing vacuously on an empty fixture set.
    expect(checked).toBeGreaterThan(10)
    expect(overbooked).toEqual([])
  })

  it('are only ever placed on days the clinic opens', () => {
    const sundays = appointments.filter(
      (b) => new Date(`${b.scheduledDate}T00:00:00`).getDay() === 0,
    )

    expect(sundays).toEqual([])
  })
})

describe('availability', () => {
  it('marks a slot unavailable once it is full', async () => {
    const booked = appointments.find((b) => b.status !== 'cancelled')!
    const rows = await slotsApi.listAvailability(booked.scheduledDate)
    const slot = rows.find((r) => r.time === booked.slotTime)

    expect(slot).toBeDefined()
    expect(slot!.booked).toBeGreaterThan(0)
    expect(slot!.available).toBe(slot!.isOpen && slot!.booked < slot!.capacity)
  })

  it('frees the seat back up when a booking is cancelled', async () => {
    const target = appointments.find((b) => b.status === 'confirmed')!
    const before = await slotsApi.listAvailability(target.scheduledDate)
    const seatsBefore = before.find((r) => r.time === target.slotTime)!.booked

    target.status = 'cancelled'

    const after = await slotsApi.listAvailability(target.scheduledDate)
    const seatsAfter = after.find((r) => r.time === target.slotTime)!.booked

    expect(seatsAfter).toBe(seatsBefore - 1)

    target.status = 'confirmed'
  })

  it('reports no slots on a Sunday', async () => {
    // Walk forward to the next Sunday from today.
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    expect(await slotsApi.listAvailability(iso)).toEqual([])
  })
})
