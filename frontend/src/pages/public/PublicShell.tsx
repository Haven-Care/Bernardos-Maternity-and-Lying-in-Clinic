import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { formatTime } from '../../lib/format'

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
          <Link
            to="/login"
            className="shrink-0 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
          >
            Staff login
          </Link>
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
