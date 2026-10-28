import type { AppointmentStatus, BookingRequest } from '../types/appointment'

export type VisitAction = 'arrive' | 'complete' | 'no-show'
export const VISIT_ACTION_LABELS: Record<VisitAction, string> = {
  arrive: 'Mark arrived', complete: 'Complete visit', 'no-show': 'Mark no-show',
}
export function visitActions(booking: Pick<BookingRequest, 'status' | 'scheduledDate' | 'slotTime'>, today: string, time: string): VisitAction[] {
  const actions: VisitAction[] = []
  if (booking.scheduledDate <= today) {
    if (['pending', 'rescheduled'].includes(booking.status)) actions.push('arrive')
    if (booking.status === 'arrived') actions.push('complete')
    if (['pending', 'rescheduled'].includes(booking.status) &&
      (booking.scheduledDate < today || booking.slotTime <= time)) actions.push('no-show')
  }
  return actions
}

export const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
  arrived: 'Arrived',
  no_show: 'No-show',
}
