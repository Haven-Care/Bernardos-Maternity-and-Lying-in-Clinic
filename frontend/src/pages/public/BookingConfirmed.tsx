import type { BookingRequest } from '../../types/appointment'
import { Button } from '../../components/ui/Button'
import { formatDateLong, formatTime } from '../../lib/format'

/**
 * The terminal screen — the appointment is booked.
 *
 * **The wording matters more than the layout here.** This screen used to say
 * the opposite three times over, because a booking was a request that staff
 * confirmed later and a patient who read it as settled would not expect the
 * call. `createBooking` writes `confirmed` now, so the seat is held before this
 * renders and hedging would be the lie.
 *
 * What survives the change is the reason that copy was careful: the no-show.
 * The confirmation call used to double as a reminder and there is no longer one,
 * so this screen has to make the date stick on its own — hence the plain
 * statement of when to arrive rather than a generic success message.
 *
 * The reference number is what staff ask for on the phone, so it is the largest
 * thing on the screen.
 *
 * The summary repeats only what the patient chose or typed. Email is left out:
 * it comes from the account rather than the form, so showing it back reads as
 * something they entered and might need to check.
 */
export function BookingConfirmed({
  booking,
  onBookAnother,
}: {
  booking: BookingRequest
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
        Your appointment is confirmed for{' '}
        <span className="font-semibold text-gray-700">
          {formatDateLong(booking.scheduledDate)},{' '}
          {formatTime(booking.slotTime)}
        </span>
        . Please arrive a few minutes early.
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
