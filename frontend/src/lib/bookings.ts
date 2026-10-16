import type { AppointmentStatus, BookingRequest } from '../types/appointment'

/**
 * Which actions a booking still allows.
 *
 * A completed or cancelled visit is history — offering Cancel on it would be
 * offering something the server will refuse.
 *
 * `pending` is kept only for rows created before bookings were accepted on
 * submission. Nothing produces it now, but an old one is still a live
 * appointment its owner may want to drop, and the server will still act on it.
 */
export const ACTIONABLE: ReadonlySet<AppointmentStatus> = new Set([
  'pending',
  'confirmed',
  'rescheduled',
])

export type BookingFilter = 'all' | 'upcoming' | 'past' | 'cancelled'

export const BOOKING_FILTERS: { id: BookingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
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
 * A live booking whose day has gone without being marked completed counts as
 * past — it happened, or it didn't, but it is not coming up.
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
        return ACTIONABLE.has(b.status) && b.scheduledDate >= today
      case 'past':
        return (
          b.status === 'completed' ||
          (ACTIONABLE.has(b.status) && b.scheduledDate < today)
        )
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
