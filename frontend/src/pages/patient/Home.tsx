import { Link } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { filterBookings } from '../../lib/bookings'
import { isoDate, today } from '../../lib/dates'
import { formatDateLong, formatTime } from '../../lib/format'
import { ErrorState, LoadingState } from '../../components/ui/states'
import { StatusBadge } from '../../components/ui/Badge'
import { PublicShell } from '../public/PublicShell'
import { ClinicServiceCatalog } from '../../components/ClinicServiceCatalog'

export function Home() {
  const account = useAsync(() => api.patientAuth.getAccount())
  const bookings = useAsync(() => api.myBookings.listMyBookings())
  const next = bookings.data && filterBookings(bookings.data, 'upcoming', isoDate(today()))[0]
  const recent = bookings.data && filterBookings(bookings.data, 'all', isoDate(today())).slice(0, 2)
  const firstName = account.data?.fullName?.trim().split(/\s+/)[0] || 'there'

  return (
    <PublicShell>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <div className="min-w-0 rounded-2xl sm:px-8 sm:py-10 lg:col-span-2 bg-gradient-to-br from-brand-700 to-brand-500 px-5 py-7 text-white shadow-sm">
        <p className="text-sm text-brand-100">Welcome back</p>
        <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl tracking-tight">Hello, {firstName}!</h1>
        <p className="mt-2 max-w-sm text-sm text-brand-50">Your appointments and clinic services, all in one place.</p>
      </div>

      <section className="min-w-0" aria-labelledby="next-appointment">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="next-appointment" className="text-base font-semibold text-gray-900">Next appointment</h2>
          <Link to="/patient/bookings?tab=upcoming" className="text-sm font-semibold text-brand-700">View all</Link>
        </div>
        {bookings.loading && !bookings.data ? <LoadingState /> : bookings.error ? (
          <ErrorState error={bookings.error} onRetry={bookings.reload} />
        ) : next ? (
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40 break-words">
                <p className="font-semibold text-gray-900">{next.serviceName}</p>
                <p className="mt-1 text-sm text-gray-600">{formatDateLong(next.scheduledDate)} · {formatTime(next.slotTime)}</p>
                <p className="mt-2 text-xs text-gray-500">Reference {next.referenceNo}</p>
              </div>
              <StatusBadge status={next.status} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-5 text-sm text-gray-600">
            No upcoming appointment yet. Choose a service and time that work for you.
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="Quick actions">
        <Link to="/book" className="rounded-2xl bg-brand-600 p-4 text-white shadow-sm transition-colors hover:bg-brand-700">
          <span className="text-2xl" aria-hidden="true">＋</span>
          <span className="mt-3 block text-sm font-semibold">Book appointment</span>
          <span className="mt-1 block text-xs text-brand-50">Find an available time</span>
        </Link>
        <Link to="/patient/bookings" className="rounded-2xl border border-border bg-white p-4 text-brand-700 shadow-sm transition-colors hover:border-brand-300">
          <span className="text-2xl" aria-hidden="true">◷</span>
          <span className="mt-3 block text-sm font-semibold">Booking history</span>
          <span className="mt-1 block text-xs text-gray-500">View or manage visits</span>
        </Link>
      </section>

      <div className="min-w-0 lg:col-span-2"><ClinicServiceCatalog /></div>

      {recent && recent.length > 0 && (
        <section className="min-w-0 lg:col-span-2" aria-labelledby="recent-activity">
          <h2 id="recent-activity" className="mb-3 text-base font-semibold text-gray-900">Recent activity</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white px-4">
            {recent.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{booking.serviceName}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatDateLong(booking.scheduledDate)}</p>
                </div>
                <StatusBadge status={booking.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </PublicShell>
  )
}
