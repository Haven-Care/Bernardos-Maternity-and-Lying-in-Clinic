import { useState } from 'react'
import * as api from '../../../api'
import { Button } from '../../../components/ui/Button'
import { Modal, ConfirmModal } from '../../../components/ui/Modal'
import { StatusBadge } from '../../../components/ui/Badge'
import { useToast } from '../../../components/ui/toast-context'
import {
  formatDateTime,
  formatTimestamp,
  initials,
} from '../../../lib/format'
import type { BookingRequest } from '../../../types/appointment'
import { RescheduleModal } from './RescheduleModal'
import { clinicDate } from '../../../lib/dateRange'
import { ACTIONABLE } from '../../../lib/bookings'
import { APPOINTMENT_LABELS, visitActions, VISIT_ACTION_LABELS, type VisitAction } from '../../../lib/visits'

/** Staff appointment details and visit workflow actions. */
export function BookingDetail({
  booking,
  open,
  onClose,
  onChanged,
}: {
  booking: BookingRequest
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [visitAction, setVisitAction] = useState<VisitAction>()
  const actions = visitActions(booking, clinicDate(new Date().toISOString()), new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const visitApi = { confirm: api.appointments.confirmBooking, arrive: api.appointments.arriveBooking, complete: api.appointments.completeBooking, 'no-show': api.appointments.noShowBooking }

  function finish(title: string, message: string) {
    toast.success(title, message)
    onChanged()
    onClose()
  }

  async function run(
    action: () => Promise<unknown>,
    title: string,
    message: string,
  ) {
    setBusy(true)
    try {
      await action()
      finish(title, message)
    } catch (err) {
      toast.error(
        'Something went wrong',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const resolved =
    booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show'

  return (
    <>
      <Modal open={open} busy={busy} onClose={onClose} title="Booking" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials(booking.patientName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {booking.patientName}
              </p>
              <p className="text-xs text-gray-400">
                {booking.referenceNo} · Submitted{' '}
                {formatTimestamp(booking.submittedAt)}
              </p>
            </div>
          </div>

          <dl className="flex flex-col divide-y divide-border border-y border-border">
            <Row label="Contact" value={booking.contactNumber} />
            <Row label="Email" value={booking.email} />
            <Row label="Service" value={booking.serviceName} />
            <Row
              label="Status"
              value={<StatusBadge status={booking.status} />}
            />
            <Row
              label="Date & Time"
              value={formatDateTime(booking.scheduledDate, booking.slotTime)}
            />
            <Row label="Reason for Visit" value={booking.reasonForVisit} />
          </dl>

          {resolved ? (
            <p className="text-center text-xs text-gray-400">
              This booking is {APPOINTMENT_LABELS[booking.status].toLowerCase()} and can no longer be actioned.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {actions.map((action) => <Button key={action} variant={action === 'no-show' ? 'secondary' : 'primary'} disabled={busy} onClick={() => setVisitAction(action)}>{VISIT_ACTION_LABELS[action]}</Button>)}
              {ACTIONABLE.has(booking.status) && <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setRescheduling(true)}
              >
                Reschedule
              </Button>}
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel appointment
              </Button>
            </div>
          )}
        </div>
      </Modal>
      {visitAction && <ConfirmModal open={true} loading={busy} onClose={() => { if (!busy) setVisitAction(undefined) }}
        title={VISIT_ACTION_LABELS[visitAction]} message={`${VISIT_ACTION_LABELS[visitAction]} for ${booking.patientName} (${booking.referenceNo})?`}
        tone={visitAction === 'no-show' ? 'danger' : 'primary'} confirmLabel={VISIT_ACTION_LABELS[visitAction]}
        onConfirm={() => void run(() => visitApi[visitAction](booking.id), 'Visit updated', 'The appointment status has been saved.')} />}

      {rescheduling && (
        <RescheduleModal
          booking={booking}
          open={rescheduling}
          onClose={() => setRescheduling(false)}
          onDone={(message) => {
            setRescheduling(false)
            finish('Appointment Rescheduled', message)
          }}
        />
      )}

      {/*
        Cancelling notifies the patient and frees their slot, so it gets a
        confirmation step rather than firing straight off a single click.
      */}
      <ConfirmModal
        open={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        loading={busy}
        title="Cancel appointment"
        message={`Cancel ${booking.patientName}'s ${booking.serviceName}? The slot will be freed and their booking history updated.`}
        confirmLabel="Cancel appointment"
        onConfirm={() =>
          void run(
            () => api.appointments.cancelBooking(booking.id),
            'Appointment Cancelled',
            'The appointment has been cancelled. The patient can see the update in History.',
          )
        }
      />
    </>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-xs font-medium text-gray-900 sm:text-right">{value}</dd>
    </div>
  )
}
