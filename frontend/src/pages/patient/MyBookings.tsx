import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BookingRequest, RescheduleRequest } from '../../types/appointment'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/Modal'
import { AsyncBoundary, EmptyState } from '../../components/ui/states'
import { useToast } from '../../components/ui/toast-context'
import { formatDateLong, formatTime } from '../../lib/format'
import { PublicShell } from '../public/PublicShell'
import { RescheduleRequestModal } from './RescheduleRequestModal'

/**
 * The patient's own bookings.
 *
 * Cards, not the portal's table. Staff read this data on a desktop and need to
 * scan twenty rows; a patient reads three on a phone and needs each one to be
 * legible and actionable without horizontal scrolling.
 *
 * Nothing here takes an account id — the server reads it from the token, so
 * asking for someone else's bookings is not a request that can be formed.
 */
export function MyBookings() {
  const bookings = useAsync(() => api.myBookings.listMyBookings())
  const requests = useAsync(() => api.myBookings.listMyRescheduleRequests())

  function reload() {
    bookings.reload()
    requests.reload()
  }

  return (
    <PublicShell>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">My bookings</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Your appointments and their status.
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
        >
          Book again
        </Link>
      </div>

      <div className="mt-4">
        <AsyncBoundary
          state={bookings}
          empty={
            <EmptyState
              title="No bookings yet"
              description="When you book an appointment it will show up here."
            />
          }
        >
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="When you book an appointment it will show up here."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    // An open request is the one on this booking that has not
                    // been decided. Approved and declined ones are history and
                    // must not keep the warning banner up.
                    openRequest={(requests.data ?? []).find(
                      (r) => r.bookingId === booking.id && r.status === 'pending',
                    )}
                    onChanged={reload}
                  />
                ))}
              </ul>
            )
          }
        </AsyncBoundary>
      </div>
    </PublicShell>
  )
}

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
const ACTIONABLE = new Set(['pending', 'confirmed', 'rescheduled'])

function BookingCard({
  booking,
  openRequest,
  onChanged,
}: {
  booking: BookingRequest
  openRequest?: RescheduleRequest
  onChanged: () => void
}) {
  const toast = useToast()
  const [cancelling, setCancelling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)

  const actionable = ACTIONABLE.has(booking.status)

  async function cancel() {
    setCancelling(true)

    try {
      await api.myBookings.cancelMyBooking(booking.id)
      toast.success('Booking cancelled', 'The time has been given back.')
      setConfirmingCancel(false)
      onChanged()
    } catch (err) {
      toast.error(
        'Could not cancel',
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setCancelling(false)
    }
  }

  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{booking.serviceName}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {formatDateLong(booking.scheduledDate)},{' '}
            {formatTime(booking.slotTime)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Reference {booking.referenceNo}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/*
        No "we're reviewing this" line any more — a booking is confirmed the
        moment it is made, and the badge above already says so. The `pending`
        message that used to sit here would only ever have shown on rows created
        before that change.
      */}

      {openRequest && (
        <div className="mt-3 rounded-card border border-warning-500/30 bg-warning-50 p-3 text-xs text-warning-700">
          <div className="flex items-center gap-2">
            <Badge tone="warning">Reschedule requested</Badge>
          </div>
          <p className="mt-1.5">
            You asked to move this to{' '}
            <span className="font-semibold">
              {formatDateLong(openRequest.proposedDate)},{' '}
              {formatTime(openRequest.proposedTime)}
            </span>
            . Until the clinic approves, come in at the time above.
          </p>
        </div>
      )}

      {actionable && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => setRescheduling(true)}
            // One open proposal per booking. A second would leave staff
            // choosing which one approving actually applies.
            disabled={openRequest !== undefined}
          >
            {openRequest ? 'Reschedule requested' : 'Request another time'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/*
        Cancelling applies immediately and cannot be undone — the slot goes back
        into availability and someone else may take it within the minute. The
        design has no confirmation here (gap #7 in the flowchart spec); this
        adds one.
      */}
      <ConfirmModal
        open={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        onConfirm={() => void cancel()}
        title="Cancel this booking?"
        message={`This gives up ${formatDateLong(booking.scheduledDate)} at ${formatTime(booking.slotTime)}. You can’t undo it — someone else may take the time, and you’d have to book again.`}
        confirmLabel="Cancel booking"
        loading={cancelling}
      />

      {rescheduling && (
        <RescheduleRequestModal
          booking={booking}
          open={rescheduling}
          onClose={() => setRescheduling(false)}
          onRequested={onChanged}
        />
      )}
    </li>
  )
}
