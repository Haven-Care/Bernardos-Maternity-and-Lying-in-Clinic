import type { Weekday } from '../types/common'
import type { AppointmentSlot, SlotAvailability, SlotInput } from '../types/slot'
import { apiFetch } from './client'

/**
 * The whole weekly grid. **Staff only** — it includes blocked slots and their
 * capacities, which is an Administration view.
 *
 * The public booking form must not call this. It wants `listOpenWeekdays`.
 */
export async function listSlots(weekday?: Weekday): Promise<AppointmentSlot[]> {
  return apiFetch<AppointmentSlot[]>(
    `/slots${weekday ? `?weekday=${weekday}` : ''}`,
  )
}

/**
 * Which weekdays the clinic opens at all. Public.
 *
 * Exists so the booking form can grey out the days it cannot offer without
 * asking for the staff-only grid — which it used to do, and which meant a
 * patient saw every date disabled and "No times on this day" underneath.
 */
export async function listOpenWeekdays(): Promise<Weekday[]> {
  return apiFetch<Weekday[]>('/slots/weekdays')
}

/**
 * Slots for a specific date, with live occupancy.
 *
 * Backs both the Appointment Slots table's "Booked Today" column and the public
 * booking form's list of open times.
 *
 * The count comes from the same database function that `book_appointment`
 * consults, so the form cannot offer a time that the booking then refuses.
 * Cancelled bookings free their seat; every other status holds it. The count
 * never looked at `pending` versus `confirmed`, which is why accepting bookings
 * on submission changed nothing here.
 */
export async function listAvailability(
  date: string,
): Promise<SlotAvailability[]> {
  return apiFetch<SlotAvailability[]>(`/slots/availability?date=${date}`)
}

export async function createSlot(input: SlotInput): Promise<AppointmentSlot> {
  return apiFetch<AppointmentSlot>('/slots', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSlot(
  id: string,
  input: SlotInput,
): Promise<AppointmentSlot> {
  return apiFetch<AppointmentSlot>(`/slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Open or block a slot.
 *
 * Blocking hides it from the public booking form immediately but leaves
 * existing bookings in it alone — the design says so explicitly, and it matters
 * because staff use this to stop *new* bookings on a day that is already partly
 * booked.
 */
export async function setSlotOpen(
  id: string,
  isOpen: boolean,
): Promise<AppointmentSlot> {
  return apiFetch<AppointmentSlot>(`/slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isOpen }),
  })
}
