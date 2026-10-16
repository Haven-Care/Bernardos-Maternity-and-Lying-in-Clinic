import type {
  BookingRequest,
  RescheduleRequest,
  RescheduleRequestInput,
} from '../types/appointment'
import { apiFetch } from './client'

/**
 * A patient's own bookings — mobile screen U30, Booking History.
 *
 * Nothing here takes an account id. The server reads it from the token, so
 * asking for someone else's bookings is not a request that can be formed.
 */

export async function listMyBookings(): Promise<BookingRequest[]> {
  return apiFetch<BookingRequest[]>('/me/bookings')
}

/**
 * Cancel.
 *
 * Applies immediately, unlike a reschedule. Giving up a slot costs the clinic
 * nothing and frees the time for someone else; requiring approval to cancel
 * would keep a room booked for someone who is not coming.
 *
 * Destructive and irreversible, so the UI puts a confirmation dialog in front
 * of it — gap #7 in the flowchart spec notes the design has none.
 */
export async function cancelMyBooking(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/me/bookings/${id}`, { method: 'DELETE' })
}

/**
 * Ask to move an appointment.
 *
 * This does **not** move it. The proposal goes to a staff queue and the original
 * date keeps its slot until someone approves.
 *
 * Booking is automatic but moving is not, and the asymmetry is deliberate:
 * taking a free slot costs the clinic nothing, while vacating one they have
 * already planned staffing around is a decision they should make.
 *
 * One open request per booking; asking twice returns a 409 rather than queueing
 * a second proposal staff would have to choose between.
 */
export async function requestReschedule(
  bookingId: string,
  input: RescheduleRequestInput,
): Promise<RescheduleRequest> {
  return apiFetch<RescheduleRequest>(
    `/me/bookings/${bookingId}/reschedule-request`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** So Booking History can show "reschedule requested" against a booking. */
export async function listMyRescheduleRequests(): Promise<RescheduleRequest[]> {
  return apiFetch<RescheduleRequest[]>('/me/reschedule-requests')
}
