import { Spinner } from './states'

/** Covers the sign-in form while authentication and role verification finish. */
export function AuthLoadingScreen({ label = 'Signing you in…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface-muted px-6 text-center">
      <img src="/images/clinic-logo.jpg" alt="Bernardo’s Maternity and Lying-in Clinic" className="size-20 rounded-full object-contain" width={80} height={80} />
      <Spinner className="size-9" />
      <div>
        <h1 className="text-lg font-semibold text-brand-700">{label}</h1>
        <p className="mt-2 text-sm text-gray-600">Please wait while we securely open your account.</p>
      </div>
    </div>
  )
}
