import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { Button } from './Button'

/**
 * Dialog built on the native `<dialog>` element, so focus trapping, the top
 * layer, and inertness of the page behind come from the platform rather than
 * hand-rolled JS.
 *
 * Escape and backdrop clicks both close. `onClose` is the single exit — the
 * caller owns `open`, so a dialog can't get out of sync with its own state.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  headerAction,
  dirty = false,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dirty?: boolean
  busy?: boolean
  headerAction?: ReactNode
}) {
  useUnsavedChanges(open && dirty)
  const titleId = useId()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const requestClose = useCallback(() => {
    if (busy) return
    if (dirty) setConfirmingDiscard(true)
    else onClose()
  }, [busy, dirty, onClose])
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    // Only the dialog’s own Escape request should dismiss it. File inputs
    // also emit cancel when their picker is closed without selecting a file.
    const handleCancel = (event: Event) => {
      if (event.target !== dialog) return
      event.preventDefault()
      requestClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [requestClose])

  const width = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-6xl',
  }[size]

  return (
    <><dialog
      ref={ref}
      aria-labelledby={titleId}
      // Clicks land on the dialog element itself only when they hit the
      // backdrop — the inner wrapper stops anything inside the panel.
      onClick={requestClose}
      className={`m-auto w-[calc(100%-2rem)] rounded-card border border-border bg-surface p-0 text-gray-900 shadow-xl backdrop:bg-gray-900/40 ${width}`}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-gray-500">{description}</p>
            )}
          </div>
          {headerAction && <div className="ml-auto shrink-0">{headerAction}</div>}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="size-4"
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
        </header>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
      {confirmingDiscard && <ConfirmModal
        open={open}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={() => { setConfirmingDiscard(false); onClose() }}
        title="Discard unsaved changes?"
        message="Your unsaved changes will be lost."
        confirmLabel="Discard changes"
      />}
    </>
  )
}

/** Confirm-or-cancel, for destructive actions like Log out and Cancel booking. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}
