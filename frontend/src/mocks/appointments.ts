import type { AppointmentStatus, BookingRequest } from '../types/appointment'
import { weekdayOf } from '../lib/dates'
import { slots } from './slots'
import { addDays, daysFromToday, isoDate, timestampFromToday, today } from './util'

/**
 * Bookings spread across the past, today, and the coming week.
 *
 * The Dashboard's stat tiles and pie chart are **derived from this array**, not
 * hardcoded — so confirming or cancelling a request in the UI moves the numbers.
 * That is the behaviour worth demoing, and it also means the aggregation logic
 * is already written when the backend takes over.
 */

const NAMES = [
  ['Marian Santos', '0969 213 2286', 'mariansantos@gmail.com', 'pat-1'],
  ['Jane Dela Cruz', '0918 552 7741', 'jane.delacruz@gmail.com', 'pat-2'],
  ['Chris Chan', '0905 447 1188', 'chrischan@gmail.com', 'pat-3'],
  ['Angela Reyes', '0916 330 2255', 'angela.reyes@gmail.com', 'pat-4'],
  ['Liza Mercado', '0939 771 0043', 'liza.mercado@gmail.com', 'pat-5'],
  ['Nica Bautista', '0922 118 3390', 'nica.bautista@gmail.com', null],
  ['Rowena Cruz', '0933 664 2201', 'rowena.cruz@gmail.com', null],
  ['Kim Villanueva', '0947 220 7781', 'kim.villanueva@gmail.com', null],
] as const

const SERVICES = [
  ['svc-1', 'Pre-natal Check-up'],
  ['svc-2', 'Consultation'],
  ['svc-3', 'Ultrasound'],
  ['svc-4', 'Follow-up'],
] as const

const REASONS = [
  'I think I’m pregnant',
  'Routine monthly check-up',
  'Follow-up on last ultrasound',
  'Experiencing mild cramps',
  'Requesting prenatal vitamins',
  'Post-delivery check-up',
]

/** Nudge off Sunday — the clinic is closed and has no slots. */
function bookableDate(dayOffset: number): string {
  let date = addDays(today(), dayOffset)
  if (date.getDay() === 0) date = addDays(date, dayOffset >= 0 ? 1 : -1)
  return isoDate(date)
}

/**
 * Slots for a date that still have room, given what's already been placed.
 *
 * The fixtures have to respect capacity for the same reason the app does: the
 * product promises no double-booking, and a seeded calendar showing two
 * patients in a one-patient slot contradicts that on the first screen anyone
 * looks at.
 */
function openTimesFor(date: string, taken: Map<string, number>): string[] {
  return slots
    .filter((slot) => slot.weekday === weekdayOf(date) && slot.isOpen)
    .filter(
      (slot) => (taken.get(`${date}|${slot.time}`) ?? 0) < slot.capacity,
    )
    .map((slot) => slot.time)
    .sort()
}

interface Spec {
  dayOffset: number
  status: AppointmentStatus
}

/**
 * Status by recency: past visits resolved, today confirmed, upcoming a mix of
 * confirmed and still-pending requests awaiting staff review.
 */
const SPECS: Spec[] = [
  // Past — resolved
  { dayOffset: -21, status: 'completed' },
  { dayOffset: -18, status: 'completed' },
  { dayOffset: -16, status: 'cancelled' },
  { dayOffset: -14, status: 'completed' },
  { dayOffset: -11, status: 'completed' },
  { dayOffset: -9, status: 'rescheduled' },
  { dayOffset: -7, status: 'completed' },
  { dayOffset: -6, status: 'completed' },
  { dayOffset: -4, status: 'cancelled' },
  { dayOffset: -3, status: 'completed' },
  { dayOffset: -2, status: 'completed' },
  { dayOffset: -1, status: 'completed' },
  // Today — the Today's Schedule tile
  { dayOffset: 0, status: 'confirmed' },
  { dayOffset: 0, status: 'confirmed' },
  { dayOffset: 0, status: 'confirmed' },
  { dayOffset: 0, status: 'completed' },
  { dayOffset: 0, status: 'confirmed' },
  // This week — confirmed
  { dayOffset: 1, status: 'confirmed' },
  { dayOffset: 1, status: 'confirmed' },
  { dayOffset: 2, status: 'confirmed' },
  { dayOffset: 2, status: 'rescheduled' },
  { dayOffset: 3, status: 'confirmed' },
  { dayOffset: 4, status: 'confirmed' },
  // Awaiting review — these populate the Booking Requests tab
  { dayOffset: 2, status: 'pending' },
  { dayOffset: 3, status: 'pending' },
  { dayOffset: 5, status: 'pending' },
  { dayOffset: 6, status: 'pending' },
  { dayOffset: 8, status: 'pending' },
]

function build(): BookingRequest[] {
  // (date|time) → bookings already placed there, so capacity is never exceeded.
  const taken = new Map<string, number>()
  const rows: BookingRequest[] = []

  SPECS.forEach((spec, i) => {
    const [patientName, contactNumber, email, patientId] =
      NAMES[i % NAMES.length]
    const [serviceId, serviceName] = SERVICES[i % SERVICES.length]
    const scheduledDate = bookableDate(spec.dayOffset)

    const open = openTimesFor(scheduledDate, taken)
    // Every slot that day is full — drop this one rather than overbook.
    if (open.length === 0) return

    const slotTime = open[i % open.length]
    const key = `${scheduledDate}|${slotTime}`
    taken.set(key, (taken.get(key) ?? 0) + 1)

    rows.push({
      id: `apt-${rows.length + 1}`,
      referenceNo: `BR-${(812 + rows.length).toString()}`,
      patientName,
      contactNumber,
      email,
      patientId,
      serviceId,
      serviceName,
      scheduledDate,
      slotTime,
      status: spec.status,
      reasonForVisit: REASONS[i % REASONS.length],
      // Requests are submitted a few days before the requested date.
      submittedAt: timestampFromToday(spec.dayOffset - 3, '14:20'),
    })
  })

  return rows
}

export const appointments: BookingRequest[] = build()

// ---------------------------------------------------------------------------
// Mutators — these deliberately mutate the array in place, so Confirm / Cancel /
// Reschedule actually change what every screen renders. A prototype where the
// buttons do nothing does not demo.
// ---------------------------------------------------------------------------

export function setStatus(
  id: string,
  status: AppointmentStatus,
): BookingRequest | undefined {
  const row = appointments.find((a) => a.id === id)
  if (row) row.status = status
  return row
}

export function reschedule(
  id: string,
  scheduledDate: string,
  slotTime: string,
): BookingRequest | undefined {
  const row = appointments.find((a) => a.id === id)
  if (row) {
    row.scheduledDate = scheduledDate
    row.slotTime = slotTime
    row.status = 'rescheduled'
  }
  return row
}

export function add(row: Omit<BookingRequest, 'id' | 'referenceNo'>): BookingRequest {
  const next: BookingRequest = {
    ...row,
    id: `apt-${appointments.length + 1}`,
    referenceNo: `BR-${(812 + appointments.length).toString()}`,
  }
  appointments.push(next)
  return next
}

export { daysFromToday }
