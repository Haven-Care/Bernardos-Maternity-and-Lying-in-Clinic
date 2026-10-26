import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import type { PatientAccount } from '../../types/patientAccount'
import { useConfirmLeave } from '../../hooks/useUnsavedChanges'
import { isSessionError } from '../../lib/api'
import { useAsync } from '../../hooks/useAsync'
import { formatTime } from '../../lib/format'
import { ConfirmModal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'
import { CalendarIcon, DashboardIcon, PatientsIcon, SettingsIcon } from '../../components/layout/icons'

/** Shared patient shell: bottom navigation on phones, wider layouts on desktops. */
export function PublicShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const hours = useAsync(() => api.clinic.getOperatingHours())
  const account = useAsync(() => api.patientAuth.getAccount().catch((error) => { if (isSessionError(error)) return null; throw error }))

  return (
    <div className="flex min-h-full flex-col bg-brand-50/40">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold text-brand-700">
              {clinic.data?.name ?? 'Bernardo’s Maternity & Lying-in Clinic'}
            </p>
            <p className="truncate text-xs text-gray-400">
              Book an appointment
            </p>
          </div>
          <PatientNav account={account.data} loading={account.loading} error={!!account.error} onRetry={account.reload} />
        </div>
      </header>

      <main className={`mx-auto w-full min-w-0 flex-1 px-4 py-5 pb-28 sm:py-8 ${narrow ? 'max-w-4xl' : 'max-w-6xl'}`}>
        {children}
      </main>

      <footer className="hidden border-t border-border bg-surface sm:block">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-gray-500">
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

          <p className="mt-5 text-xs text-gray-400">
            © {new Date().getFullYear()} Bernardo’s Maternity &amp; Lying-in Clinic. All rights reserved.
          </p>
        </div>
      </footer>
      <PatientBottomNav />
    </div>
  )
}

/** Account loading failures offer retry rather than pretending the user signed out. */
function PatientNav({ account, loading, error, onRetry }: { account: PatientAccount | null | undefined; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { confirmLeave, cancelLeave } = useConfirmLeave()
  const [confirming, setConfirming] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Neither state is right until the first request settles, and flashing "Sign
  // in" at someone who is signed in is the more jarring of the two mistakes.
  if (loading) return <span className="w-16 shrink-0" />

  if (error && !account) return <button type="button" onClick={onRetry} className="shrink-0 text-xs text-brand-700 underline">Retry account</button>

  if (!account) {
    return (
      <div className="flex shrink-0 items-center gap-3">
        <Link
          to="/login"
          className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Sign in
        </Link>

      </div>
    )
  }

  async function logOut() {
    if (!confirmLeave()) { setConfirming(false); return }
    setLoggingOut(true)
    try {
      await api.patientAuth.logout()
      navigate('/book', { replace: true })
      // The header, the bookings list and the wizard all hold account-derived
      // state. Reloading is blunt but it is the one thing that cannot leave a
      // stale signed-in fragment on screen after signing out.
      window.location.reload()
    } catch (err) {
      cancelLeave()
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
    <div className="hidden shrink-0 items-center gap-3 sm:flex">
      <NavLink to="/patient/home" className="text-sm font-medium text-gray-600 hover:text-brand-700">Home</NavLink>
      <NavLink to="/book" className="text-sm font-medium text-gray-600 hover:text-brand-700">Book</NavLink>
      <Link
        to="/patient/bookings"
        className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        History
      </Link>
      <Link
        to="/patient/account"
        className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        Account
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

const patientTabs = [
  { to: '/patient/home', label: 'Home', icon: DashboardIcon },
  { to: '/book', label: 'Book', icon: CalendarIcon },
  { to: '/patient/bookings', label: 'History', icon: PatientsIcon },
  { to: '/patient/account', label: 'Profile', icon: SettingsIcon },
]

function PatientBottomNav() {
  const location = useLocation()

  return (
    <nav aria-label="Patient navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 shadow-[0_-4px_18px_rgba(13,93,92,0.08)] backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {patientTabs.map(({ to, label, icon: Icon }) => {
          const active = to === '/book' ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function Logo() {
  return (
    <img
      src="/images/clinic-logo.jpg"
      alt="Bernardo's Maternity and Lying-in Clinic logo"
      className="size-10 shrink-0 rounded-full object-contain"
      width={40}
      height={40}
    />
  )
}
