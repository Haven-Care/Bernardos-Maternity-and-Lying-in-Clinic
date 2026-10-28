import type {
  BookingRequest,
  CreateBookingInput,
  RescheduleBookingInput,
} from '../types/appointment'
import { datedList } from './pagination'
import { apiFetch } from './client'

/**
 * Bookings, from the staff side.
 *
 * The capacity and availability checks that used to live in this file are gone:
 * they are now in `book_appointment`, inside the transaction that does the
 * insert. That was always where they belonged — a check in the browser is a
 * suggestion, and two patients racing for the last seat both pass it.
 */

export async function listBookings(dates?: { from: string; to: string }): Promise<BookingRequest[]> {
  return datedList<BookingRequest>('/bookings', dates)
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
 * Comes back Booked (`pending`), with its slot reserved immediately.
 * The patient is expected at that time; staff record arrival at the visit.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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

export function arriveBooking(id: string): Promise<BookingRequest> {
  return apiFetch(`/bookings/${id}/arrive`, { method: 'POST' })
}
export function noShowBooking(id: string): Promise<BookingRequest> {
  return apiFetch(`/bookings/${id}/no-show`, { method: 'POST' })
}
