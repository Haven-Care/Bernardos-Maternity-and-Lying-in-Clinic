import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** The centred card every auth screen sits in. */
export function AuthShell({
  title,
  subtitle,
  children,
  before,
  footer,
  onLogoClick,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  /** Rendered above the logo — the "Back to sign in" link on the reset screens. */
  before?: ReactNode
  footer?: ReactNode
  onLogoClick?: () => void
}) {
  return (
    <div className="flex min-h-dvh min-w-0 items-center justify-center bg-brand-50/40 px-4 py-6 sm:py-10">
      <div className="w-full min-w-0 max-w-md rounded-card border border-border bg-surface p-5 sm:p-7 shadow-sm">
        {before}

        <div className="flex flex-col items-center gap-2 text-center">
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} aria-label="Clinic logo" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              <img
                src="/images/clinic-logo.jpg"
                alt=""
                className="size-20 object-contain"
                width={80}
                height={80}
              />
            </button>
          ) : (
            <img
              src="/images/clinic-logo.jpg"
              alt="Bernardo's Maternity and Lying-in Clinic logo"
              className="size-20 object-contain"
              width={80}
              height={80}
            />
          )}
          <p className="text-sm leading-tight font-semibold text-brand-700">
            Bernardo’s Maternity and
            <br />
            Lying-in Clinic
          </p>
        </div>

        {title && (
          <div className="mt-6">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
        )}

        <div className="mt-5">{children}</div>

        {footer && <div className="mt-4">{footer}</div>}

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Bernardo’s Maternity &amp; Lying-in Clinic. All rights reserved.
        </p>
      </div>
    </div>
  )
}

/** Recovery screens return to the shared login page. */
export function BackToLogin({ to = '/login' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
    >
      <svg
        className="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back to sign in
    </Link>
  )
}
