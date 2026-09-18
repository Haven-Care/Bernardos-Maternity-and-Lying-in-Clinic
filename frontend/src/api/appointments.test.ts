import { describe, expect, it } from 'vitest'
import type { CreateBookingInput } from '../types/appointment'
import * as appointmentsApi from './appointments'
import { isoDate, today } from '../lib/dates'
import { services } from '../mocks/services'

/**
 * The public booking form is the one surface a member of the public can POST to,
 * so its write path is the one that has to hold on its own. These cover the
 * checks a server must own: no double-booking, no booking a blocked slot, no
 * booking a service the clinic has withdrawn.
 *
 * Dates are pushed well past the seeded window so each case starts from an empty
 * day and nothing here depends on what the fixtures happened to place.
 */

/** The next `weekday` at least `fromOffset` days out. Monday is 1. */
function futureWeekday(weekday: number, fromOffset: number): string {
  const date = today()
  date.setDate(date.getDate() + fromOffset)
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1)
  return isoDate(date)
}

const MONDAY = 1
const WEDNESDAY = 3

function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    patientName: 'Juana Dela Cruz',
    contactNumber: '0917 123 4567',
    email: 'juana@gmail.com',
    serviceId: 'svc-1',
    scheduledDate: futureWeekday(MONDAY, 60),
    slotTime: '09:00',
    reasonForVisit: 'Routine monthly check-up',
    ...overrides,
  }
}

describe('createBooking', () => {
  it('stores the service name, not the id', async () => {
    const booking = await appointmentsApi.createBooking(
      input({ scheduledDate: futureWeekday(MONDAY, 60) }),
    )

    // Regression: this field held `input.serviceId`, so every request submitted
    // from the public form showed up in the staff table as "svc-1".
    expect(booking.serviceName).toBe('Pre-natal Check-up')
    expect(booking.serviceId).toBe('svc-1')
  })

  it('always lands as pending with a reference number', async () => {
    const booking = await appointmentsApi.createBooking(
      input({ scheduledDate: futureWeekday(MONDAY, 120) }),
    )

    expect(booking.status).toBe('pending')
    expect(booking.referenceNo).toMatch(/^BR-\d+$/)
    expect(booking.patientId).toBeNull()
  })

  it('normalises the contact details staff will read', async () => {
    const booking = await appointmentsApi.createBooking(
      input({
        scheduledDate: futureWeekday(MONDAY, 150),
        patientName: '  Juana Dela Cruz  ',
        contactNumber: '+63 917 123 4567',
        email: '  Juana@Gmail.COM ',
        reasonForVisit: '  Routine monthly check-up  ',
      }),
    )

    expect(booking.patientName).toBe('Juana Dela Cruz')
    expect(booking.contactNumber).toBe('0917 123 4567')
    expect(booking.email).toBe('juana@gmail.com')
    expect(booking.reasonForVisit).toBe('Routine monthly check-up')
  })

  it('refuses to overfill a slot', async () => {
    // Monday 09:00 holds exactly one patient.
    const scheduledDate = futureWeekday(MONDAY, 200)

    await expect(
      appointmentsApi.createBooking(input({ scheduledDate })),
    ).resolves.toBeDefined()

    await expect(
      appointmentsApi.createBooking(input({ scheduledDate })),
    ).rejects.toThrow(/just filled/i)
  })

  it('refuses a blocked slot', async () => {
    // Wednesday 13:00 is blocked in the fixtures.
    await expect(
      appointmentsApi.createBooking(
        input({
          scheduledDate: futureWeekday(WEDNESDAY, 60),
          slotTime: '13:00',
        }),
      ),
    ).rejects.toThrow(/no longer available/i)
  })

  it('refuses a time the clinic does not offer', async () => {
    await expect(
      appointmentsApi.createBooking(
        input({ scheduledDate: futureWeekday(MONDAY, 60), slotTime: '23:00' }),
      ),
    ).rejects.toThrow(/no longer available/i)
  })

  it('refuses a service that has been deactivated', async () => {
    const ultrasound = services.find((s) => s.id === 'svc-3')!
    ultrasound.active = false

    try {
      await expect(
        appointmentsApi.createBooking(
          input({
            serviceId: 'svc-3',
            scheduledDate: futureWeekday(MONDAY, 250),
          }),
        ),
      ).rejects.toThrow(/no longer offered/i)
    } finally {
      ultrasound.active = true
    }
  })
})
