/**
 * A booking in progress, parked across the sign-in round trip.
 *
 * The wizard keeps its state in `BookingPage`, which is the right place for it
 * — a patient who refreshes mid-booking should get a clean start rather than a
 * half-filled step three pointing at a slot that has since been taken.
 *
 * But gating the Details step introduces a navigation the patient did not ask
 * for. Without this, choosing a service and a time and then being bounced to
 * login means coming back to an empty form and picking both again, which is
 * where people give up.
 *
 * So: `sessionStorage`, not `localStorage`. It survives the redirect and dies
 * with the tab. A draft is never worth restoring tomorrow — the slot it names
 * may be gone — and it is cleared the moment it is read back.
 */
const KEY = 'havencare.draft-booking'

export interface DraftBooking {
  serviceId: string
  scheduledDate: string
  slotTime: string
}

export function saveDraftBooking(draft: DraftBooking): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Private-mode Safari and a full quota both throw here. Losing the draft
    // costs two taps; throwing would lose the whole booking.
  }
}

/** Reads and clears in one step — a draft is only ever restored once. */
export function takeDraftBooking(): DraftBooking | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null

    sessionStorage.removeItem(KEY)
    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'serviceId' in parsed &&
      'scheduledDate' in parsed &&
      'slotTime' in parsed
    ) {
      return parsed as DraftBooking
    }

    return null
  } catch {
    return null
  }
}

export function clearDraftBooking(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to do — see above.
  }
}
