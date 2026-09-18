import type {
  BookingRequest,
  CreateBookingInput,
  RescheduleBookingInput,
} from '../types/appointment'
import * as mock from '../mocks/appointments'
import { weekdayOf } from '../lib/dates'
import { formatPhMobile } from '../lib/validate'
import { clinicSettings } from '../mocks/clinic'
import { services } from '../mocks/services'
import { slots } from '../mocks/slots'
import { mockDelay, mockReject } from '../mocks/util'
// import { apiFetch } from './client'

export async function listBookings(): Promise<BookingRequest[]> {
  // BACKEND: return apiFetch<BookingRequest[]>('/bookings')
  return mockDelay(mock.appointments)
}

export async function getBooking(id: string): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/${id}`)
  const row = mock.appointments.find((a) => a.id === id)
  if (!row) return mockReject(`Booking not found: ${id}`)
  return mockDelay(row)
}

/** Look up by the reference number a patient was given, e.g. `BR-0812`. */
export async function getBookingByReference(
  referenceNo: string,
): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/reference/${referenceNo}`)
  const row = mock.appointments.find(
    (a) => a.referenceNo.toLowerCase() === referenceNo.trim().toLowerCase(),
  )
  if (!row) return mockReject(`No booking found for ${referenceNo}`)
  return mockDelay(row)
}

/**
 * Submitted from the public booking form. No account required.
 *
 * **The checks below are the server's job, and they are written here so the
 * form's error path is real rather than theoretical.** A public form is exactly
 * where two patients race for the last seat in a slot: both see it free, both
 * submit, and only a check at write time stops the double-booking the pitch
 * promises won't happen. The whole block is deleted at swap time — the server
 * returns the conflict and the form renders the same message.
 *
 * Every rejection message is written for a patient, not a developer. This is the
 * only screen in the app a member of the public ever sees.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>('/bookings', { method: 'POST', body: JSON.stringify(input) })
  const service = services.find((s) => s.id === input.serviceId)
  if (!service?.active) {
    return mockReject('That service is no longer offered. Please pick another.')
  }

  const slot = slots.find(
    (s) =>
      s.weekday === weekdayOf(input.scheduledDate) && s.time === input.slotTime,
  )
  // A blocked slot is indistinguishable from a non-existent one to a patient,
  // and deliberately so — staff block a time to stop new bookings, and the
  // reason is theirs.
  if (!slot?.isOpen) {
    return mockReject(
      'That time is no longer available. Please choose another one.',
    )
  }

  const onDate = mock.appointments.filter(
    (a) => a.scheduledDate === input.scheduledDate && a.status !== 'cancelled',
  )

  if (onDate.filter((a) => a.slotTime === input.slotTime).length >= slot.capacity) {
    return mockReject(
      'That time was just filled. Please choose another one.',
    )
  }

  // The day-wide ceiling from the pitch deck ("daily capacity limits"), separate
  // from per-slot capacity — a day can fill before any one slot does. `null`
  // today, so this is dormant until Administration grows a control for it.
  if (
    clinicSettings.dailyBookingCapacity !== null &&
    onDate.length >= clinicSettings.dailyBookingCapacity
  ) {
    return mockReject(
      'The clinic is fully booked on that day. Please choose another date.',
    )
  }

  const created = mock.add({
    ...input,
    // Normalised on the way in, so staff never see three spellings of the same
    // number across the Booking Requests table.
    patientName: input.patientName.trim(),
    contactNumber: formatPhMobile(input.contactNumber),
    email: input.email.trim().toLowerCase(),
    reasonForVisit: input.reasonForVisit.trim(),
    patientId: null,
    // Denormalised so the Booking Requests table renders without a join.
    serviceName: service.name,
    // Always pending: a public submission is a *request*, and staff confirm it.
    status: 'pending',
    submittedAt: new Date().toISOString(),
  })
  return mockDelay(created)
}

export async function confirmBooking(id: string): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/${id}/confirm`, { method: 'POST' })
  const row = mock.setStatus(id, 'confirmed')
  if (!row) return mockReject(`Booking not found: ${id}`)
  return mockDelay(row)
}

export async function cancelBooking(id: string): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/${id}`, { method: 'DELETE' })
  const row = mock.setStatus(id, 'cancelled')
  if (!row) return mockReject(`Booking not found: ${id}`)
  return mockDelay(row)
}

export async function completeBooking(id: string): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/${id}/complete`, { method: 'POST' })
  const row = mock.setStatus(id, 'completed')
  if (!row) return mockReject(`Booking not found: ${id}`)
  return mockDelay(row)
}

export async function rescheduleBooking(
  id: string,
  input: RescheduleBookingInput,
): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>(`/bookings/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(input) })
  const row = mock.reschedule(id, input.scheduledDate, input.slotTime)
  if (!row) return mockReject(`Booking not found: ${id}`)
  return mockDelay(row)
}
