import type { Weekday } from '../types/common'
import type { AppointmentSlot, SlotAvailability, SlotInput } from '../types/slot'
import { WEEKDAYS } from '../types/common'
import { appointments } from '../mocks/appointments'
import { slots } from '../mocks/slots'
import { mockDelay, mockReject, uid } from '../mocks/util'
// import { apiFetch } from './client'

function weekdayOf(date: string): Weekday {
  // getDay() is 0-indexed from Sunday; WEEKDAYS starts at Monday.
  const index = new Date(`${date}T00:00:00`).getDay()
  return WEEKDAYS[(index + 6) % 7]
}

export async function listSlots(weekday?: Weekday): Promise<AppointmentSlot[]> {
  // BACKEND: return apiFetch<AppointmentSlot[]>(`/slots${weekday ? `?weekday=${weekday}` : ''}`)
  const rows = weekday ? slots.filter((s) => s.weekday === weekday) : slots
  return mockDelay([...rows].sort((a, b) => a.time.localeCompare(b.time)))
}

/**
 * Slots for a specific date, with live occupancy.
 *
 * Backs both the Appointment Slots table's "Booked Today" column and the public
 * booking form's availability list. Cancelled bookings free their seat back up;
 * everything else holds it.
 */
export async function listAvailability(
  date: string,
): Promise<SlotAvailability[]> {
  // BACKEND: return apiFetch<SlotAvailability[]>(`/slots/availability?date=${date}`)
  const weekday = weekdayOf(date)

  const rows = slots
    .filter((s) => s.weekday === weekday)
    .map((s) => {
      const booked = appointments.filter(
        (a) =>
          a.scheduledDate === date &&
          a.slotTime === s.time &&
          a.status !== 'cancelled',
      ).length

      return {
        ...s,
        booked,
        available: s.isOpen && booked < s.capacity,
      }
    })
    .sort((a, b) => a.time.localeCompare(b.time))

  return mockDelay(rows)
}

export async function createSlot(input: SlotInput): Promise<AppointmentSlot> {
  // BACKEND: return apiFetch<AppointmentSlot>('/slots', { method: 'POST', body: JSON.stringify(input) })
  const clash = slots.find(
    (s) => s.weekday === input.weekday && s.time === input.time,
  )
  if (clash) {
    return mockReject(`A ${input.time} slot already exists on ${input.weekday}`)
  }

  const created: AppointmentSlot = { ...input, id: uid('slot'), isOpen: true }
  slots.push(created)
  return mockDelay(created)
}

export async function updateSlot(
  id: string,
  input: SlotInput,
): Promise<AppointmentSlot> {
  // BACKEND: return apiFetch<AppointmentSlot>(`/slots/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  const s = slots.find((x) => x.id === id)
  if (!s) return mockReject(`Slot not found: ${id}`)
  Object.assign(s, input)
  return mockDelay(s)
}

/**
 * Open or block a slot.
 *
 * Blocking hides it from the public booking form immediately but leaves existing
 * bookings in it alone — the design says so explicitly, and it matters because
 * staff will use this to stop *new* bookings on a day they're already partly
 * booked.
 */
export async function setSlotOpen(
  id: string,
  isOpen: boolean,
): Promise<AppointmentSlot> {
  // BACKEND: return apiFetch<AppointmentSlot>(`/slots/${id}`, { method: 'PATCH', body: JSON.stringify({ isOpen }) })
  const s = slots.find((x) => x.id === id)
  if (!s) return mockReject(`Slot not found: ${id}`)
  s.isOpen = isOpen
  return mockDelay(s)
}
