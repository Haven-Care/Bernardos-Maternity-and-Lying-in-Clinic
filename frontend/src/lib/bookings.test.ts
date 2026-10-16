import { describe, expect, it } from 'vitest'
import type { AppointmentStatus, BookingRequest } from '../types/appointment'
import { filterBookings, isBookingFilter } from './bookings'

const TODAY = '2026-10-10'

function booking(
  id: string,
  scheduledDate: string,
  status: AppointmentStatus,
  slotTime = '09:00',
): BookingRequest {
  return {
    id,
    referenceNo: id,
    patientName: 'Juana Dela Cruz',
    contactNumber: '0969 123 2286',
    email: '',
    patientId: null,
    serviceId: 'svc',
    serviceName: 'Pre-natal Check-up',
    scheduledDate,
    slotTime,
    status,
    reasonForVisit: '',
    submittedAt: '2026-10-01T00:00:00Z',
  }
}

const ROWS = [
  booking('next-week', '2026-10-17', 'confirmed'),
  booking('today-late', TODAY, 'confirmed', '13:00'),
  booking('today-early', TODAY, 'rescheduled', '08:00'),
  booking('last-week', '2026-10-03', 'completed'),
  booking('missed', '2026-10-09', 'confirmed'),
  booking('dropped', '2026-10-20', 'cancelled'),
  booking('legacy', '2026-10-12', 'pending'),
]

const ids = (rows: BookingRequest[]) => rows.map((b) => b.id)

describe('filterBookings', () => {
  it('upcoming: live bookings from today on, soonest first', () => {
    expect(ids(filterBookings(ROWS, 'upcoming', TODAY))).toEqual([
      'today-early',
      'today-late',
      'legacy',
      'next-week',
    ])
  })

  it('past: completed, plus live bookings whose day has gone, newest first', () => {
    expect(ids(filterBookings(ROWS, 'past', TODAY))).toEqual([
      'missed',
      'last-week',
    ])
  })

  it('cancelled: only cancelled ones, whatever their date', () => {
    expect(ids(filterBookings(ROWS, 'cancelled', TODAY))).toEqual(['dropped'])
  })

  it('all: everything, newest first', () => {
    expect(ids(filterBookings(ROWS, 'all', TODAY))).toEqual([
      'dropped',
      'next-week',
      'legacy',
      'today-late',
      'today-early',
      'missed',
      'last-week',
    ])
  })

  it('does not reorder the array it was given', () => {
    const rows = [...ROWS]
    filterBookings(rows, 'all', TODAY)
    expect(rows).toEqual(ROWS)
  })
})

describe('isBookingFilter', () => {
  it('accepts the four tabs and nothing else', () => {
    expect(isBookingFilter('upcoming')).toBe(true)
    expect(isBookingFilter('Upcoming')).toBe(false)
    expect(isBookingFilter(null)).toBe(false)
  })
})
