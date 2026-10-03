import type { Database } from '../db/types.js'
import type {
  BookingRequest,
  RescheduleRequest,
} from '../contract/appointment.js'
import type { PatientAccount } from '../contract/patientAccount.js'

type AppointmentRow = Database['public']['Tables']['appointments']['Row']
type RescheduleRow =
  Database['public']['Tables']['reschedule_requests']['Row']
type AccountRow = Database['public']['Tables']['patient_accounts']['Row']

export function toBooking(row: AppointmentRow): BookingRequest {
  return {
    id: row.id,
    referenceNo: row.reference_no,

    patientName: row.patient_name,
    contactNumber: row.contact_number,
    email: row.email,
    patientId: row.patient_id,

    serviceId: row.service_id,
    serviceName: row.service_name,

    scheduledDate: row.scheduled_date,
    slotTime: row.slot_time,

    status: row.status,
    reasonForVisit: row.reason_for_visit,

    submittedAt: row.submitted_at,
  }
}

/**
 * A reschedule request, joined to the booking it proposes to move.
 *
 * The booking's current date and time travel with it because the staff queue
 * renders "Sep 24, 08:00 → Sep 26, 10:00" — showing only the proposal would
 * make the decision impossible without a second lookup per row.
 */
export function toRescheduleRequest(
  row: RescheduleRow & { appointments: AppointmentRow | null },
): RescheduleRequest {
  const booking = row.appointments

  return {
    id: row.id,
    bookingId: row.booking_id,

    proposedDate: row.proposed_date,
    proposedTime: row.proposed_time,

    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,

    referenceNo: booking?.reference_no ?? '',
    patientName: booking?.patient_name ?? '',
    serviceName: booking?.service_name ?? '',
    currentDate: booking?.scheduled_date ?? '',
    currentTime: booking?.slot_time ?? '',
  }
}

export function toPatientAccount(row: AccountRow): PatientAccount {
  return {
    id: row.id,
    fullName: row.full_name,
    contactNumber: row.contact_number,
    email: row.email,
    emailNotifications: row.email_notifications,
    createdAt: row.created_at,
  }
}
