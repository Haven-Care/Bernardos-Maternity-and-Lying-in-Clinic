import type { DateString, DateTimeString, TimeString } from './common'

/**
 * The five statuses in the Booking Requests table and the dashboard's
 * Appointments Overview pie chart.
 *
 * `no_show` is deliberately absent — it appears nowhere in the prototype. Add it
 * only if the clinic asks for it, since it changes the pie chart too.
 */
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'rescheduled',
  'cancelled',
  'completed',
]

/**
 * A patient's booking, from submitted request through to completed visit.
 *
 * One row of the Booking Requests table and one chip on the Calendar. For a
 * `pending` request, `scheduledDate` / `slotTime` are the patient's *preferred*
 * time (the detail panel labels them "Preferred Date & Time"); once staff
 * confirm, they are the actual booking.
 */
export interface BookingRequest {
  id: string
  /** Human-facing reference, e.g. `BR-0812`. Shown to the patient on booking. */
  referenceNo: string

  /**
   * Contact details as typed into the public booking form. Denormalized on
   * purpose: a booking can exist before a patient record does, which is why
   * `patientId` is nullable.
   */
  patientName: string
  contactNumber: string
  email: string
  /** Linked patient record, once staff match this booking to one. */
  patientId: string | null

  serviceId: string
  /** Denormalized for table rendering, so the list needs no join. */
  serviceName: string

  scheduledDate: DateString
  slotTime: TimeString

  status: AppointmentStatus
  reasonForVisit: string

  submittedAt: DateTimeString
}

/** Payload for the public booking form. No account required. */
export interface CreateBookingInput {
  patientName: string
  contactNumber: string
  email: string
  serviceId: string
  scheduledDate: DateString
  slotTime: TimeString
  reasonForVisit: string
}

/** Payload for the Reschedule Appointment modal — New Date, New Time. */
export interface RescheduleBookingInput {
  scheduledDate: DateString
  slotTime: TimeString
}
