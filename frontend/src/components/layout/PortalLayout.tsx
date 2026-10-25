import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import * as api from '../../api'
import { useConfirmLeave } from '../../hooks/useUnsavedChanges'
import { useAsync } from '../../hooks/useAsync'
import { ConfirmModal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'
import {
  BellIcon,
  CalendarIcon,
  DashboardIcon,
  InventoryIcon,
  LogoutIcon,
  PatientsIcon,
  SettingsIcon,
} from './icons'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', Icon: DashboardIcon },
  { to: '/admin/appointments', label: 'Appointment', Icon: CalendarIcon },
  { to: '/admin/inventory', label: 'Inventory', Icon: InventoryIcon },
  { to: '/admin/patients', label: 'Patient Records', Icon: PatientsIcon },
  { to: '/admin/administration', label: 'Administration', Icon: SettingsIcon },
]

/**
 * The command center shell — sidebar, header with live date, user footer.
 *
 * Desktop-first on purpose: the clinic runs Windows 10 desktops (feasibility
 * interview), and every frame of the prototype is a desktop layout. The sidebar
 * collapses to icons below `lg` so a tablet still works, but this is not the
 * patient-facing surface and shouldn't be optimised for phones.
 */
export function PortalLayout() {
  const navigate = useNavigate()
  const { confirmLeave, cancelLeave } = useConfirmLeave()
  const toast = useToast()
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const profile = useAsync(() => api.account.getProfile())

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (!confirmLeave()) { setConfirmLogout(false); return }
    setLoggingOut(true)
    try {
      await api.account.logout()
      navigate('/login', { replace: true })
    } catch (err) {
      cancelLeave()
      toast.error('Could not log out', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setLoggingOut(false)
      setConfirmLogout(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header clinicName={clinic.data?.name} />
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-[72px] flex h-[calc(100dvh-72px)] w-16 shrink-0 flex-col border-r border-border bg-surface lg:w-60">
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {NAV.map(({ to, end, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-2.5">
              <Avatar name={profile.data?.fullName ?? ''} />
              <div className="hidden min-w-0 flex-1 lg:block">
                <p className="truncate text-[13px] font-semibold text-brand-700">
                  {profile.data?.fullName ?? '—'}
                </p>
                <p className="truncate text-[11px] text-gray-400 capitalize">
                  {profile.data?.role ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                aria-label="Log out"
                title="Log out"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <LogoutIcon className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <ConfirmModal
          open={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={() => void handleLogout()}
          loading={loggingOut}
          title="Log out"
          message="End your session? Unsaved changes will be lost."
          confirmLabel="Log out"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function Header({ clinicName }: { clinicName?: string }) {
  const notifications = useAsync(() => api.dashboard.listNotifications())
  const [open, setOpen] = useState(false)
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0

  return (
    <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Logo />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold italic text-brand-700 sm:text-base lg:text-lg">
            {clinicName ?? "Bernardo's Maternity and Lying-in Clinic"}
          </p>
          <p className="text-xs italic text-brand-600 sm:text-sm">HavenCare System</p>
        </div>
      </div>
      <LiveDate />

      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-danger-500 ring-2 ring-white" />
          )}
        </button>

        {open && (
          <>
            {/* Click-away layer, so the panel closes on any outside click. */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-lg">
              <p className="border-b border-border px-4 py-2.5 text-sm font-semibold text-gray-900">
                Notifications
              </p>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {notifications.data?.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-2.5 text-sm ${n.read ? 'text-gray-500' : 'text-gray-900'}`}
                  >
                    {n.message}
                  </li>
                ))}
                {notifications.data?.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-gray-400">
                    Nothing new
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

/** The prototype's header shows a live date and time. */
function LiveDate() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const formatted = now.toLocaleString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <p className="hidden shrink-0 text-xs text-gray-500 md:block lg:text-sm">
      {formatted.replace(' at ', ' at ')}
    </p>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
      {initials || '··'}
    </span>
  )
}

function Logo() {
  return (
    <img
      src="/images/clinic-logo.jpg"
      alt="Bernardo's Maternity and Lying-in Clinic logo"
      className="size-12 shrink-0 rounded-full object-contain"
      width={48}
      height={48}
    />
  )
}
