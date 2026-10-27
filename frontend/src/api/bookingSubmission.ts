import type { CreateBookingInput } from '../types/appointment'
import { createBooking } from './appointments'
import { updateAccount } from './patientAuth'

/** Save reusable contact details only after a successful booking and explicit consent. */
export async function submitBooking(input: CreateBookingInput, savePersonalDetails = false) {
  const booking = await createBooking(input)
  if (!savePersonalDetails) return { booking }

  try {
    const profile = await updateAccount({
      fullName: booking.patientName,
      contactNumber: booking.contactNumber,
    })
    return { booking, profile }
  } catch {
    // The appointment already exists. A failed profile update must never ask
    // the patient to submit the booking again and reserve another slot.
    return { booking, detailsSaveFailed: true }
  }
}
