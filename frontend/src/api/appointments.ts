import type {
  BookingRequest,
  CreateBookingInput,
  RescheduleBookingInput,
} from '../types/appointment'
import { apiFetch } from './client'

/**
 * Bookings, from the staff side.
 *
 * The capacity and availability checks that used to live in this file are gone:
 * they are now in `book_appointment`, inside the transaction that does the
 * insert. That was always where they belonged — a check in the browser is a
 * suggestion, and two patients racing for the last seat both pass it.
 */

export async function listBookings(): Promise<BookingRequest[]> {
  return apiFetch<BookingRequest[]>('/bookings')
}

export async function getBooking(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/bookings/${id}`)
}

/** Look up by the reference number a patient was given, e.g. `BR-0812`. */
export async function getBookingByReference(
  referenceNo: string,
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(
    `/bookings/reference/${encodeURIComponent(referenceNo.trim())}`,
  )
}

/**
 * Submit a booking.
 *
 * Requires a signed-in patient. The server holds a lock on the date and time
 * while it checks capacity, so a slot cannot be sold twice — and it rejects
 * with a message written for a patient ("That time was just filled"), which
 * `apiFetch` surfaces as-is.
 *
 * Comes back `confirmed`. Submitting the form *is* the booking — that lock and
 * those checks are the whole of what staff confirmation used to mean, and they
 * have already run by the time this resolves.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Move a booking back to `confirmed`.
 *
 * No longer part of the booking flow — nothing arrives needing confirmation.
 * What it still does is settle a `rescheduled` appointment once the clinic and
 * the patient have agreed on the new time, and accept the handful of `pending`
 * rows that predate auto-acceptance. No screen calls it today.
 */
export async function confirmBooking(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/bookings/${id}/confirm`, { method: 'POST' })
}

/** Cancels rather than deletes — the Dashboard charts cancellations. */
export async function cancelBooking(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/bookings/${id}`, { method: 'DELETE' })
}

export async function completeBooking(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/bookings/${id}/complete`, {
    method: 'POST',
  })
}

/**
 * Staff moving an appointment directly — their schedule, their call.
 *
 * The patient-initiated path is a request that staff approve; see
 * `myBookings.requestReschedule`.
 */
export async function rescheduleBooking(
  id: string,
  input: RescheduleBookingInput,
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/bookings/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
