import type {
  BookingRequest,
  CreateBookingInput,
  RescheduleBookingInput,
} from '../types/appointment'
import * as mock from '../mocks/appointments'
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

/** Submitted from the public booking form. No account required. */
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingRequest> {
  // BACKEND: return apiFetch<BookingRequest>('/bookings', { method: 'POST', body: JSON.stringify(input) })
  const created = mock.add({
    ...input,
    patientId: null,
    serviceName: input.serviceId,
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
