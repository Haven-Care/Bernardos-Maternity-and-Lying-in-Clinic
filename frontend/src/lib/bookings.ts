import type { AppointmentStatus, BookingRequest } from '../types/appointment'

/** Patient cancellation/reschedule are allowed before arrival. */
export const ACTIONABLE: ReadonlySet<AppointmentStatus> = new Set([
  'pending',
  'rescheduled',
])

export type BookingFilter = 'all' | 'upcoming' | 'completed' | 'cancelled'

export const BOOKING_FILTERS: { id: BookingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function isBookingFilter(value: string | null): value is BookingFilter {
  return BOOKING_FILTERS.some((f) => f.id === value)
}

/**
 * The patient's bookings for one filter tab, in that tab's order.
 *
 * Upcoming is soonest first, because the next visit is the one a patient is
 * looking for. The others are newest first.
 *
 * Decided by calendar day, not by the minute: an appointment stays upcoming
 * for the whole of its day, so a patient running late still finds it there.
 * A live booking whose day has gone without being marked completed stays in
 * All. Only staff-recorded completed visits appear in Completed.
 *
 * `today` is `YYYY-MM-DD`, passed in so the filter is a pure function.
 */
export function filterBookings(
  rows: BookingRequest[],
  filter: BookingFilter,
  today: string,
): BookingRequest[] {
  const matches = rows.filter((b) => {
    switch (filter) {
      case 'upcoming':
        return (ACTIONABLE.has(b.status) || b.status === 'arrived') && b.scheduledDate >= today
      case 'completed':
        return b.status === 'completed'
      case 'cancelled':
        return b.status === 'cancelled'
      case 'all':
        return true
    }
  })

  // `YYYY-MM-DD HH:mm` sorts correctly as a string.
  const when = (b: BookingRequest) => `${b.scheduledDate} ${b.slotTime}`
  const direction = filter === 'upcoming' ? 1 : -1

  return matches.sort((a, b) => direction * when(a).localeCompare(when(b)))
}
