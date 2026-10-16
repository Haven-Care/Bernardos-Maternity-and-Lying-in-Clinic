import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** The centred card every auth screen sits in. */
export function AuthShell({
  title,
  subtitle,
  children,
  before,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  /** Rendered above the logo — the "Back to login" link on the reset screens. */
  before?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-brand-50/40 p-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-7 shadow-sm">
        {before}

        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/images/clinic-logo.jpg"
            alt="Bernardo's Maternity and Lying-in Clinic logo"
            className="size-20 object-contain"
            width={80}
            height={80}
          />
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

        <p className="mt-6 text-center text-[11px] text-gray-400">
          © {new Date().getFullYear()} HavenCare. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export function BackToLogin() {
  return (
    <Link
      to="/login"
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
      Back to login
    </Link>
  )
}
