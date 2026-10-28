import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { BookingRequest, RescheduleRequest } from '../../types/appointment'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/Modal'
import { Tabs } from '../../components/ui/Tabs'
import { Table, type Column } from '../../components/ui/Table'
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
import { formatDate, formatDateLong, formatTime, formatTimestamp } from '../../lib/format'
import { PublicShell } from '../public/PublicShell'
import { RescheduleRequestModal } from './RescheduleRequestModal'

/**
 * The patient's own bookings.
 *
 * Desktop tables support scanning and inline row expansion. Mobile keeps
 * expandable cards so details and actions fit without horizontal scrolling.
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

  const openRequestFor = (booking: BookingRequest) => (requests.data ?? []).find(
    (request) => request.bookingId === booking.id && request.status === 'pending',
  )
  const columns: Column<BookingRequest>[] = [
    { key: 'reference', header: 'Reference', render: (booking) => <span className="whitespace-nowrap font-medium text-gray-900">{booking.referenceNo}</span> },
    { key: 'service', header: 'Service', render: (booking) => <span className="block max-w-64 break-words font-medium text-gray-900">{booking.serviceName}</span> },
    { key: 'date', header: 'Date', className: 'whitespace-nowrap', render: (booking) => formatDate(booking.scheduledDate) },
    { key: 'time', header: 'Time', className: 'whitespace-nowrap', render: (booking) => formatTime(booking.slotTime) },
    { key: 'status', header: 'Status', render: (booking) => <StatusBadge status={booking.status} /> },
    { key: 'actions', header: 'Actions', align: 'right', render: (booking) => ACTIONABLE.has(booking.status)
      ? <BookingActions booking={booking} openRequest={openRequestFor(booking)} onChanged={reload} compact />
      : <span className="text-gray-400">—</span> },
  ]

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
              <>
                <div className="hidden overflow-hidden rounded-card border border-border bg-surface lg:block">
                  <p className="border-b border-border px-4 py-3 text-xs text-gray-500">Click an appointment row to expand its details.</p>
                  <Table columns={columns} rows={shown} rowKey={(booking) => booking.id}
                    expandable={{
                      label: (booking) => `booking ${booking.referenceNo}`,
                      render: (booking) => <section aria-label={`Booking details for ${booking.referenceNo}`} className="min-w-0">
                        <h2 className="mb-4 text-sm font-semibold text-gray-900">Booking details</h2>
                        <BookingDetails booking={booking} />
                        <BookingNotices booking={booking} openRequest={openRequestFor(booking)} />
                      </section>,
                    }} />
                </div>
                <ul className="grid min-w-0 items-start gap-4 md:grid-cols-2 lg:hidden">
                  {shown.map((booking) => <BookingCard key={booking.id} booking={booking} openRequest={openRequestFor(booking)} onChanged={reload} />)}
                </ul>
              </>
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

interface BookingRowProps {
  booking: BookingRequest
  openRequest?: RescheduleRequest
  onChanged: () => void
}

function BookingCard({ booking, openRequest, onChanged }: BookingRowProps) {
  return (
    <li className="min-w-0 rounded-card border border-border bg-surface p-4">
      <details className="group min-w-0">
        <summary aria-label={`Details for booking ${booking.referenceNo}`}
          className="flex w-full min-w-0 cursor-pointer list-none flex-wrap items-start justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 basis-40 break-words">
            <span className="block font-semibold text-gray-900">{booking.serviceName}</span>
            <span className="mt-0.5 block text-sm text-gray-600">
              {formatDateLong(booking.scheduledDate)},{' '}
              {formatTime(booking.slotTime)}
            </span>
            <span className="mt-1 block text-xs text-gray-400">
              Reference {booking.referenceNo}
            </span>
            <span className="mt-2 block text-xs font-semibold text-brand-700"><span className="group-open:hidden">View booking details</span><span className="hidden group-open:inline">Hide booking details</span></span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <StatusBadge status={booking.status} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4 text-brand-700 transition-transform group-open:rotate-90"><path d="m9 6 6 6-6 6" /></svg>
          </span>
        </summary>

        <section aria-label={`Booking details for ${booking.referenceNo}`} className="mt-4 border-t border-border pt-4">
          <BookingDetails booking={booking} />
        </section>
      </details>

      <BookingNotices booking={booking} openRequest={openRequest} />
      <BookingActions booking={booking} openRequest={openRequest} onChanged={onChanged} />
    </li>
  )
}

function BookingDetails({ booking }: { booking: BookingRequest }) {
  return (
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
  )
}

function BookingNotices({ booking, openRequest }: Pick<BookingRowProps, 'booking' | 'openRequest'>) {
  return (
    <>
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
    </>
  )
}

function BookingActions({ booking, openRequest, onChanged, compact = false }: BookingRowProps & { compact?: boolean }) {
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
    <div onClick={(event) => event.stopPropagation()}>
      {actionable && (
        <div className={compact ? 'flex items-center justify-end gap-2' : 'mt-4 flex flex-col gap-2 sm:flex-row'}>
          <Button
            variant="secondary"
            size="sm"
            className={compact ? 'justify-center whitespace-nowrap' : 'flex-1 justify-center'}
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
            className={compact ? 'justify-center whitespace-nowrap' : 'flex-1 justify-center'}
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
    </div>
  )
}

function BookingField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="mt-1 break-words whitespace-pre-wrap text-gray-900">{value || 'Not provided'}</dd>
  </div>
}
