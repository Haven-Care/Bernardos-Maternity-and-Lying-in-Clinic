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

/**
 * The booking request detail from the prototype, with its three actions.
 *
 * Confirm is the primary path and gets the full-width button; Reschedule and
 * Cancel sit below it. Only a `pending` request shows Confirm — a booking
 * that's already confirmed can still be moved or cancelled, but "confirming"
 * it again is meaningless.
 */
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
    booking.status === 'cancelled' || booking.status === 'completed'

  return (
    <>
      <Modal open={open} onClose={onClose} title="Booking Request" size="sm">
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
              label="Preferred Date & Time"
              value={formatDateTime(booking.scheduledDate, booking.slotTime)}
            />
            <Row label="Reason for Visit" value={booking.reasonForVisit} />
          </dl>

          {resolved ? (
            <p className="text-center text-xs text-gray-400">
              This request is {booking.status} and can no longer be actioned.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {booking.status === 'pending' && (
                <Button
                  variant="success"
                  loading={busy}
                  className="w-full"
                  onClick={() =>
                    void run(
                      () => api.appointments.confirmBooking(booking.id),
                      'Appointment Confirmed',
                      'The appointment has been successfully scheduled.',
                    )
                  }
                >
                  Confirm
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setRescheduling(true)}
                >
                  Reschedule
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

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
        message={`Cancel ${booking.patientName}'s ${booking.serviceName}? The slot will be freed and the patient notified.`}
        confirmLabel="Cancel appointment"
        onConfirm={() =>
          void run(
            () => api.appointments.cancelBooking(booking.id),
            'Appointment Cancelled',
            'The appointment has been cancelled and the patient notified.',
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
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-gray-900">{value}</dd>
    </div>
  )
}
