import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { BookingRequest, RescheduleRequest } from '../../types/appointment'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmModal, Modal } from '../../components/ui/Modal'
import { Tabs } from '../../components/ui/Tabs'
import { AsyncBoundary, EmptyState } from '../../components/ui/states'
import { useToast } from '../../components/ui/toast-context'
import {
  ACTIONABLE,
  BOOKING_FILTERS,
  filterBookings,
  isBookingFilter,
  type BookingFilter,
} from '../../lib/bookings'
import { isoDate, today } from '../../lib/dates'
import { formatDateLong, formatTime, formatTimestamp } from '../../lib/format'
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

  // In the query string, like the portal's tabs, so Back and a refresh keep it.
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const filter: BookingFilter = isBookingFilter(tab) ? tab : 'all'

  function reload() {
    bookings.reload()
    requests.reload()
  }

  return (
    <PublicShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Booking history</h1>
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
        <Tabs tabs={BOOKING_FILTERS} />
      </div>

      <div className="mt-4">
        <AsyncBoundary
          state={bookings}
          empty={<EmptyState {...EMPTY.all} />}
        >
          {(rows) => {
            const shown = filterBookings(rows, filter, isoDate(today()))

            if (shown.length === 0) return <EmptyState {...EMPTY[filter]} />

            return (
              <ul className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((booking) => (
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
          }}
        </AsyncBoundary>
      </div>
    </PublicShell>
  )
}

/** `all` doubles as the message for a patient with no bookings at all. */
const EMPTY: Record<BookingFilter, { title: string; description: string }> = {
  all: {
    title: 'No bookings yet',
    description: 'When you book an appointment it will show up here.',
  },
  upcoming: {
    title: 'Nothing coming up',
    description: 'Book again to see your next visit here.',
  },
  completed: {
    title: 'No completed visits',
    description: 'Appointments move here after the clinic marks them complete.',
  },
  cancelled: {
    title: 'No cancelled bookings',
    description: 'Bookings you or the clinic cancel will show up here.',
  },
}

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
  const [expanded, setExpanded] = useState(false)

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
    <li className="min-w-0 rounded-card border border-border bg-surface p-4">
      <button type="button" onClick={() => setExpanded(true)} aria-haspopup="dialog"
        aria-label={`View details for booking ${booking.referenceNo}`}
        className="flex w-full min-w-0 flex-wrap items-start justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600">
        <span className="min-w-0 flex-1 basis-40 break-words">
          <span className="block font-semibold text-gray-900">{booking.serviceName}</span>
          <span className="mt-0.5 block text-sm text-gray-600">
            {formatDateLong(booking.scheduledDate)},{' '}
            {formatTime(booking.slotTime)}
          </span>
          <span className="mt-1 block text-xs text-gray-400">
            Reference {booking.referenceNo}
          </span>
          <span className="mt-2 block text-xs font-semibold text-brand-700">View booking details</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge status={booking.status} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4 text-brand-700"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>

      {expanded && <Modal open onClose={() => setExpanded(false)} title="Booking details" description={`Reference ${booking.referenceNo}`}>
        <div className="mb-4"><StatusBadge status={booking.status} /></div>
        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <BookingField label="Service" value={booking.serviceName} wide />
          <BookingField label="Appointment date" value={formatDateLong(booking.scheduledDate)} />
          <BookingField label="Time" value={formatTime(booking.slotTime)} />
          <BookingField label="Patient" value={booking.patientName} />
          <BookingField label="Mobile number" value={booking.contactNumber} />
          <BookingField label="Email" value={booking.email} wide />
          <BookingField label="Reason for visit" value={booking.reasonForVisit} wide />
          <BookingField label="Booked on" value={formatTimestamp(booking.submittedAt)} wide />
        </dl>
      </Modal>}

      {booking.status === 'pending' && <p className="mt-3 text-xs text-gray-500">Your appointment is booked and your slot is reserved. Please arrive at the scheduled time.</p>}

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
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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

function BookingField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="mt-1 break-words whitespace-pre-wrap text-gray-900">{value || 'Not provided'}</dd>
  </div>
}
