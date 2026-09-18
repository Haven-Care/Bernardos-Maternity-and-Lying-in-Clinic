import type { AppointmentSlot } from '../types/slot'
import type { Weekday } from '../types/common'

/**
 * The slot grid from Administration → Appointment Slots.
 *
 * The prototype shows Monday's five slots (08:00, 09:00, 10:00, 11:00, 13:00)
 * with capacities of 2 / 1 / 2 / 1 / 2. Weekdays repeat that shape; Saturday is
 * the clinic's half-day per Clinic Info, so it runs morning only. Sunday is
 * closed and therefore has no slots at all.
 */
const WEEKDAY_TIMES: Array<{ time: string; capacity: number }> = [
  { time: '08:00', capacity: 2 },
  { time: '09:00', capacity: 1 },
  { time: '10:00', capacity: 2 },
  { time: '11:00', capacity: 1 },
  { time: '13:00', capacity: 2 },
]

const SATURDAY_TIMES: Array<{ time: string; capacity: number }> = [
  { time: '08:00', capacity: 2 },
  { time: '09:00', capacity: 2 },
  { time: '10:00', capacity: 1 },
]

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
]

function build(): AppointmentSlot[] {
  const rows: AppointmentSlot[] = []

  for (const weekday of WEEKDAYS) {
    for (const { time, capacity } of WEEKDAY_TIMES) {
      rows.push({
        id: `slot-${weekday}-${time.replace(':', '')}`,
        weekday,
        time,
        capacity,
        isOpen: true,
      })
    }
  }

  for (const { time, capacity } of SATURDAY_TIMES) {
    rows.push({
      id: `slot-saturday-${time.replace(':', '')}`,
      weekday: 'saturday',
      time,
      capacity,
      isOpen: true,
    })
  }

  return rows
}

export const slots: AppointmentSlot[] = build()

// One blocked slot so the "Blocked" badge and the disabled toggle both have
// something to render without the user having to go turn one off first.
const blocked = slots.find((s) => s.weekday === 'wednesday' && s.time === '13:00')
if (blocked) blocked.isOpen = false
