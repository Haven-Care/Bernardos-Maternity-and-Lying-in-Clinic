import type { BookingRequest } from '../../types/appointment'
import { Button } from '../../components/ui/Button'
import { formatDateLong, formatTime } from '../../lib/format'

/**
 * The terminal screen — a request was accepted, not an appointment booked.
 *
 * **The wording matters more than the layout here.** `createBooking` always
 * writes `pending`; staff confirm it from Booking Requests. A patient who reads
 * this as "booked" and skips the confirmation text is the no-show the clinic
 * already has a problem with, so the status badge, the heading, and the next
 * steps all say the same thing three times.
 *
 * The reference number is what staff ask for on the phone, so it is the largest
 * thing on the screen.
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
        Request received
      </h1>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        The clinic will review it and confirm by text or email. Your appointment
        isn’t final until they do.
      </p>

      <div className="mt-5 rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-[11px] font-medium tracking-wide text-brand-700 uppercase">
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
        <Row label="Name" value={booking.patientName} />
        <Row label="Service" value={booking.serviceName} />
        <Row
          label="Requested for"
          value={`${formatDateLong(booking.scheduledDate)}, ${formatTime(booking.slotTime)}`}
        />
        <Row label="Mobile" value={booking.contactNumber} />
        <Row label="Email" value={booking.email} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-gray-900">
        {value}
      </dd>
    </div>
  )
}
