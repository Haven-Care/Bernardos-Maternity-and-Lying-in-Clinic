// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with `npm run sync:types`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

import type { DateString, DateTimeString, TimeString } from './common.js'

/** Staff workflow: Booked (stored as pending) → Arrived → Completed; no approval step.
 * Cancelled/no_show are terminal; rescheduled keeps a moved slot visible.
 */
export type AppointmentStatus =
  | 'pending'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'arrived'
  | 'no_show'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'rescheduled',
  'cancelled',
  'completed',
  'arrived',
  'no_show',
]

/**
 * A patient's booking, from submission through to completed visit.
 *
 * One row of the Bookings table and one chip on the Calendar. `scheduledDate`
 * and `slotTime` are the appointment, not a preference: the seat is held the
 * moment the row exists. Staff record attendance when the patient arrives.
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

/**
 * Payload for the booking form.
 *
 * **Identity comes from the signed-in account, not from this payload.** The
 * email is the account's and is not accepted here at all — otherwise a patient
 * could book under someone else's address, and the confirmation would go to a
 * stranger.
 *
 * Name and contact number are optional *overrides*: the account already knows
 * both, and the form prefills them, but a patient may want a different number
 * called on the day. Omitted means "use what the account says".
 */
export interface CreateBookingInput {
  serviceId: string
  scheduledDate: DateString
  slotTime: TimeString
  reasonForVisit: string

  patientName?: string
  contactNumber?: string
}

/** Payload for the Reschedule Appointment modal — New Date, New Time. */
export interface RescheduleBookingInput {
  scheduledDate: DateString
  slotTime: TimeString
}

// ---------------------------------------------------------------------------
// Patient-initiated reschedule
// ---------------------------------------------------------------------------

export type RescheduleRequestStatus = 'pending' | 'approved' | 'declined'

/**
 * A patient asking to move an appointment.
 *
 * **A separate record, not a status on the booking.** Taking a free slot is
 * automatic; vacating one the clinic has already planned staffing around is
 * not. Keeping the proposal here leaves the original booking intact and its
 * slot held until staff decide, so a patient cannot rewrite a date the clinic
 * is working to.
 *
 * `pending` here means a reschedule proposal awaiting staff review. Appointment
 * `pending` is the legacy database value for an accepted booking (Booked).
 *
 * Staff rescheduling from their own modal does not create one of these — they
 * act directly, because it is their schedule.
 */
export interface RescheduleRequest {
  id: string
  bookingId: string

  proposedDate: DateString
  proposedTime: TimeString

  status: RescheduleRequestStatus
  requestedAt: DateTimeString
  decidedAt: DateTimeString | null

  /** Denormalized so the staff queue renders without a join. */
  referenceNo: string
  patientName: string
  serviceName: string
  /** What the booking currently says, for the "from → to" the queue shows. */
  currentDate: DateString
  currentTime: TimeString
}

export interface RescheduleRequestInput {
  proposedDate: DateString
  proposedTime: TimeString
}
