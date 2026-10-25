import type { AppointmentStatus, BookingRequest } from '../types/appointment'

export type VisitAction = 'confirm' | 'arrive' | 'complete' | 'no-show'
export const VISIT_ACTION_LABELS: Record<VisitAction, string> = {
  confirm: 'Confirm appointment', arrive: 'Mark arrived', complete: 'Complete visit', 'no-show': 'Mark no-show',
}
export function visitActions(booking: Pick<BookingRequest, 'status' | 'scheduledDate' | 'slotTime'>, today: string, time: string): VisitAction[] {
  const actions: VisitAction[] = []
  if (['pending', 'rescheduled'].includes(booking.status)) actions.push('confirm')
  if (booking.scheduledDate <= today) {
    if (booking.status === 'confirmed') actions.push('arrive')
    if (booking.status === 'arrived') actions.push('complete')
    if (['pending', 'confirmed', 'rescheduled'].includes(booking.status) &&
      (booking.scheduledDate < today || booking.slotTime <= time)) actions.push('no-show')
  }
  return actions
}

export const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Booked',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
  arrived: 'Arrived',
  no_show: 'No-show',
}
