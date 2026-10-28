import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicShell } from '../public/PublicShell'
import { AuthShell, BackToLogin } from './AuthShell'

export function RecoveryShell({ title, subtitle, returnTo, children }: {
  title: string; subtitle: string; returnTo?: '/patient/account'; children: ReactNode
}) {
  if (!returnTo) return <AuthShell title={title} subtitle={subtitle} before={<BackToLogin />}>{children}</AuthShell>
  return <PublicShell narrow>
    <section className="mx-auto max-w-md rounded-card border border-border bg-surface p-5 shadow-sm sm:p-7">
      <Link to={returnTo} replace className="text-sm font-medium text-brand-700 underline">Cancel password reset</Link>
      <h1 className="mt-5 text-lg font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  </PublicShell>
}
