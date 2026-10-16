import type { DateString, DateTimeString, TimeString } from './common'

/**
 * The five statuses in the Bookings table and the dashboard's Appointments
 * Overview pie chart.
 *
 * **`pending` is retired, not removed.** Bookings are accepted on submission,
 * so nothing produces it — but rows created before that change still carry it,
 * and every screen that renders a status has to keep handling it. Dropping it
 * from the union would mean recreating a Postgres enum, rewriting a column, and
 * breaking the exhaustive `Record<AppointmentStatus, …>` maps in `Badge.tsx`
 * and `AppointmentsPie.tsx`, all to delete a value that costs nothing to keep.
 *
 * The pie simply stops drawing a pending wedge: the backing view omits
 * zero-count statuses by design.
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
 * A patient's booking, from submission through to completed visit.
 *
 * One row of the Bookings table and one chip on the Calendar. `scheduledDate`
 * and `slotTime` are the appointment, not a preference: the seat is held the
 * moment the row exists. They were the patient's *preferred* time back when a
 * booking waited on staff confirmation, which is why the detail panel used to
 * label them that way.
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
 * Note `pending` below is this table's own status and is very much alive —
 * unlike the appointment status of the same name.
 *
 * It also keeps `AppointmentStatus` at five values. A sixth would add a wedge
 * to the Dashboard pie chart and an option to the status filter, both of which
 * were designed around five.
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
