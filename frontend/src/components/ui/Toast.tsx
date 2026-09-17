import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastApi, type ToastTone } from './toast-context'

/**
 * The prototype specifies eight toasts — Appointment Confirmed / Rescheduled /
 * Cancelled, Medicine Added, Record Updated, Patient Record Created / Updated.
 * All of them are the same two shapes, success or error, with a title and a
 * supporting line.
 */

const DURATION_MS = 4000

// Monotonic: Date.now() collides when two toasts fire in the same tick, which
// would give two list items the same React key.
let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = nextId++
    setToasts((current) => [...current, { id, tone, title, message }])
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      DURATION_MS,
    )
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
    }),
    [push],
  )

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        // aria-live so a screen reader announces the result of an action that
        // otherwise only changes a row's colour.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  const success = toast.tone === 'success'

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-lg">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
          success
            ? 'bg-success-500 text-white'
            : 'bg-danger-500 text-white'
        }`}
      >
        <svg
          className="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {success ? <path d="m5 13 4 4L19 7" /> : <path d="M18 6 6 18M6 6l12 12" />}
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            success ? 'text-success-700' : 'text-danger-700'
          }`}
        >
          {toast.title}
        </p>
        {toast.message && (
          <p className="mt-0.5 text-xs leading-snug text-gray-500">
            {toast.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <svg
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
