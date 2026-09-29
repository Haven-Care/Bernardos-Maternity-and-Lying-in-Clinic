import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { formatTime } from '../../lib/format'
import { ConfirmModal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'

/**
 * Chrome for the patient-facing surface.
 *
 * **Mobile-first, unlike the portal.** The staff screens target the clinic's
 * Windows 10 desktops per the feasibility interview; patients book from a phone,
 * so this shell is a single narrow column that merely gets more breathing room
 * on a larger screen, never a second column.
 *
 * Clinic name, address, and hours are read from the API rather than hardcoded —
 * they are editable in Administration → Clinic Info, and a patient seeing stale
 * opening hours is the exact failure that screen exists to prevent.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const hours = useAsync(() => api.clinic.getOperatingHours())

  return (
    <div className="flex min-h-full flex-col bg-brand-50/40">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-tight font-semibold text-brand-700">
              {clinic.data?.name ?? 'Bernardo’s Maternity & Lying-in Clinic'}
            </p>
            <p className="truncate text-[11px] text-gray-400">
              Book an appointment
            </p>
          </div>
          <PatientNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 text-xs text-gray-500">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 font-semibold text-gray-700">Visit us</p>
              <p>{clinic.data?.address}</p>
              {clinic.data && (
                <p className="mt-1">
                  {clinic.data.landline} · {clinic.data.mobile}
                </p>
              )}
            </div>

            <div>
              <p className="mb-1.5 font-semibold text-gray-700">Clinic hours</p>
              <ul className="space-y-0.5">
                {hours.data?.map((row) => (
                  <li key={row.key} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-gray-400">
                      {row.closed || !row.opensAt || !row.closesAt
                        ? 'Closed'
                        : `${formatTime(row.opensAt)} – ${formatTime(row.closesAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-gray-400">
            © {new Date().getFullYear()} HavenCare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

/**
 * Who the visitor is, and the way out.
 *
 * Signed-out, this is the staff-login link the shell has always carried plus a
 * way into the patient surface. Signed-in, it becomes the patient's own
 * navigation — there is no separate patient layout, because the booking form
 * and the bookings list are the same product and a second shell would mean two
 * headers to keep in step.
 *
 * The account is fetched rather than read from a client-side flag, so the
 * header agrees with what the server will actually answer. A failed fetch is
 * simply "signed out", which is the correct reading of an expired session.
 */
function PatientNav() {
  const navigate = useNavigate()
  const toast = useToast()
  const account = useAsync(() => api.patientAuth.getAccount())
  const [confirming, setConfirming] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Neither state is right until the first request settles, and flashing "Sign
  // in" at someone who is signed in is the more jarring of the two mistakes.
  if (account.loading) return <span className="w-16 shrink-0" />

  if (!account.data) {
    return (
      <div className="flex shrink-0 items-center gap-3">
        <Link
          to="/patient/login"
          className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Sign in
        </Link>
        <Link
          to="/login"
          className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
        >
          Staff
        </Link>
      </div>
    )
  }

  async function logOut() {
    setLoggingOut(true)
    try {
      await api.patientAuth.logout()
      navigate('/book', { replace: true })
      // The header, the bookings list and the wizard all hold account-derived
      // state. Reloading is blunt but it is the one thing that cannot leave a
      // stale signed-in fragment on screen after signing out.
      window.location.reload()
    } catch (err) {
      // Said out loud: a failed sign-out otherwise just closes the spinner and
      // leaves the patient believing they are signed out on a shared phone.
      toast.error(
        'Could not log out',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <Link
        to="/patient/bookings"
        className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        My bookings
      </Link>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
      >
        Log out
      </button>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void logOut()}
        title="Log out?"
        message="You’ll need to sign in again to book or see your bookings."
        confirmLabel="Log out"
        loading={loggingOut}
      />
    </div>
  )
}

function Logo() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z" />
      </svg>
    </span>
  )
}
