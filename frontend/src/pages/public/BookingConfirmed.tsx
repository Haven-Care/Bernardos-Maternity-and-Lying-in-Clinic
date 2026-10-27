import type { BookingRequest } from '../../types/appointment'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { formatDateLong, formatTime } from '../../lib/format'

/** A saved booking holds its slot while awaiting staff confirmation. */
export function BookingConfirmed({
  booking,
  personalDetailsStatus,
  onBookAnother,
}: {
  booking: BookingRequest
  personalDetailsStatus?: 'saved' | 'failed'
  onBookAnother: () => void
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-50 text-success-700">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>

      <h1 className="mt-4 text-lg font-semibold text-gray-900">
        You’re booked
      </h1>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Your slot is reserved for{' '}
        <span className="font-semibold text-gray-700">
          {formatDateLong(booking.scheduledDate)},{' '}
          {formatTime(booking.slotTime)}
        </span>
        . The clinic will confirm your appointment. Check History for status updates and bring your reference number when you arrive.
      </p>

      <div className="mt-5 rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">
          Your reference number
        </p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-brand-700 tabular-nums">
          {booking.referenceNo}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Keep this — the clinic will ask for it.
        </p>
      </div>

      <dl className="mt-5 space-y-2 text-left text-sm">
        <Row label="Service" value={booking.serviceName} />
        <Row
          label="Date & time"
          value={`${formatDateLong(booking.scheduledDate)}, ${formatTime(booking.slotTime)}`}
        />
        <Row label="Name" value={booking.patientName} />
        <Row label="Mobile" value={booking.contactNumber} />
        <Row label="Reason for visit" value={booking.reasonForVisit} stacked />
      </dl>

      {personalDetailsStatus === 'saved' && (
        <p role="status" className="mt-5 rounded-card border border-success-500/30 bg-success-50 p-3 text-left text-sm text-success-700">
          Your name and mobile number are saved to your profile and will be filled in for future bookings. You can update them in My profile.
        </p>
      )}
      {personalDetailsStatus === 'failed' && (
        <div role="alert" className="mt-5 rounded-card border border-warning-500/30 bg-warning-50 p-3 text-left text-sm text-warning-700">
          <p>Your appointment is booked, but we couldn’t save your details for next time. You don’t need to book again.</p>
          <Link to="/patient/account" className="mt-2 inline-block font-semibold underline">Save your details in My profile</Link>
        </div>
      )}

      <Button
        variant="secondary"
        onClick={onBookAnother}
        className="mt-6 w-full justify-center"
      >
        Book another appointment
      </Button>
    </div>
  )
}

/**
 * `stacked` puts the value under its label, for free text: a sentence or two
 * right-aligned beside the label wraps into a ragged column.
 */
function Row({
  label,
  value,
  stacked = false,
}: {
  label: string
  value: string
  stacked?: boolean
}) {
  return (
    <div
      className={`border-b border-border pb-2 last:border-0 ${
        stacked ? '' : 'flex justify-between gap-3'
      }`}
    >
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd
        className={`min-w-0 font-medium break-words text-gray-900 ${
          stacked ? 'mt-1 whitespace-pre-line' : 'text-right'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
