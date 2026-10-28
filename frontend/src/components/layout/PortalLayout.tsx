import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import * as api from '../../api'
import { useConfirmLeave } from '../../hooks/useUnsavedChanges'
import { useAsync } from '../../hooks/useAsync'
import { ConfirmModal, Modal } from '../ui/Modal'
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
  { to: '/admin', end: true, label: 'Dashboard', mobileLabel: 'Home', Icon: DashboardIcon },
  { to: '/admin/appointments', label: 'Appointment', mobileLabel: 'Visits', Icon: CalendarIcon },
  { to: '/admin/inventory', label: 'Inventory', mobileLabel: 'Inventory', Icon: InventoryIcon },
  { to: '/admin/patients', label: 'Patient Records', mobileLabel: 'Patients', Icon: PatientsIcon },
  { to: '/admin/administration', label: 'Administration', mobileLabel: 'Settings', Icon: SettingsIcon },
]

/** Sidebar on desktop and tablet; full-width content and bottom navigation on phones. */
export function PortalLayout() {
  const navigate = useNavigate()
  const { confirmLeave, cancelLeave } = useConfirmLeave()
  const toast = useToast()
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const profile = useAsync(() => api.account.getProfile())

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (!await confirmLeave()) { setConfirmLogout(false); return }
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
      <Header clinicName={clinic.data?.name} onLogout={() => setConfirmLogout(true)} />
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] w-16 shrink-0 flex-col border-r border-border bg-surface md:flex lg:w-60">
          <nav aria-label="Staff navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
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
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:size-8"
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
          <main className="min-w-0 flex-1 p-3 pb-[calc(6rem_+_env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <nav aria-label="Staff mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5 gap-1 px-1 py-2">
          {NAV.map(({ to, end, label, mobileLabel, Icon }) => (
            <NavLink key={to} to={to} end={end} title={label} aria-label={label}
              className={({ isActive }) => `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[10px] leading-tight font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>
              <Icon className="size-5 shrink-0" />
              <span>{mobileLabel}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Header({ clinicName, onLogout }: { clinicName?: string; onLogout: () => void }) {
  const notifications = useAsync(() => api.dashboard.listNotifications())
  const [open, setOpen] = useState(false)
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0

  return (
    <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Logo />
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs leading-tight font-semibold italic text-brand-700 sm:text-base lg:text-lg">
            {clinicName ?? "Bernardo's Maternity and Lying-in Clinic"}
          </p>
          <p className="truncate text-[10px] italic text-brand-600 sm:text-sm">Clinic Management System</p>
        </div>
      </div>
      <LiveDate />

      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex size-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-danger-500 ring-2 ring-white" />
          )}
        </button>

        <Modal open={open} onClose={() => setOpen(false)} title="Notifications" size="sm">
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
        </Modal>
      </div>
      <button type="button" onClick={onLogout} aria-label="Log out" className="flex size-11 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 md:hidden">
        <LogoutIcon className="size-5" />
      </button>
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
    <p className="hidden shrink-0 text-xs text-gray-500 xl:block xl:text-sm">
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
