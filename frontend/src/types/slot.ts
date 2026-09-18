import type { TimeString, Weekday } from './common'

/**
 * A bookable time slot. Administration → Appointment Slots.
 *
 * **Scheduling here is capacity-based, not duration-based.** Staff configure
 * fixed clock times per weekday, each holding N patients (08:00 AM / 2 patients
 * / 1 booked / Open). Nothing in the prototype has a duration, so do not model a
 * conventional scheduler — this is simpler, and it is what the client saw.
 *
 * `isOpen: false` is the "Blocked" state. Per the design's own note, blocking
 * hides a slot from the public booking form immediately but leaves existing
 * bookings in it untouched.
 */
export interface AppointmentSlot {
  id: string
  weekday: Weekday
  time: TimeString
  /** Patients this slot can hold. */
  capacity: number
  isOpen: boolean
}

/** A slot resolved against a specific date, for the booking form and the table. */
export interface SlotAvailability extends AppointmentSlot {
  /** Confirmed bookings on the date being viewed. */
  booked: number
  /** `isOpen && booked < capacity`. */
  available: boolean
}

export interface SlotInput {
  weekday: Weekday
  time: TimeString
  capacity: number
}
