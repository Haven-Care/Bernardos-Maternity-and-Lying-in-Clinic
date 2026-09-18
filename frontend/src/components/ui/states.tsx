import type { ReactNode } from 'react'
import { Button } from './Button'

/**
 * Loading / error / empty, in one place.
 *
 * Every list screen needs all three. Keeping them here means a screen can't
 * quietly ship with only the happy path — which is the failure mode
 * `mockFail()` exists to catch, and the reason `mockDelay()` is on every read.
 */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-brand-500 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-20"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-500">
      <Spinner className="size-6" />
      {label}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-danger-50 text-danger-700">
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">Couldn’t load this</p>
      <p className="max-w-sm text-sm text-gray-500">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 13V7a2 2 0 0 0-2-2h-5l-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * Renders the right state for an `useAsync` result.
 *
 * Takes `data` as a render prop so the happy path only ever sees defined data —
 * no `data?.map(...)` scattered through screens.
 */
export function AsyncBoundary<T>({
  state,
  children,
  empty,
}: {
  state: { data: T | undefined; error: Error | undefined; loading: boolean; reload: () => void }
  children: (data: T) => ReactNode
  empty?: ReactNode
}) {
  if (state.loading && state.data === undefined) return <LoadingState />
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />
  if (state.data === undefined) return null
  if (empty && Array.isArray(state.data) && state.data.length === 0) {
    return <>{empty}</>
  }
  return <>{children(state.data)}</>
}
