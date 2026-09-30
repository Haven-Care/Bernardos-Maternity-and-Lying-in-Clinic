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
 * may be gone — and the wizard clears it as soon as it has read it back.
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

/**
 * Reads the draft without removing it.
 *
 * Pure on purpose: it runs as a `useState` initialiser, which StrictMode calls
 * twice, and React only promises to keep *one* of the results. A read that also
 * removed would leave the second call with nothing. The caller clears it with
 * `clearDraftBooking` once it has been read.
 *
 * Anything unreadable is dropped here, since it can never be restored.
 */
export function readDraftBooking(): DraftBooking | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null

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

    clearDraftBooking()
    return null
  } catch {
    clearDraftBooking()
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
