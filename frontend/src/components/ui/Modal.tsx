import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { Button } from './Button'
import { createModalStack } from '../../lib/modalStack'

const modalStack = createModalStack()

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
    if (!dialog || !open) return
    return modalStack.add(dialog)
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
      className={`clinic-modal m-auto max-h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] overflow-hidden rounded-card border border-border bg-surface p-0 text-gray-900 shadow-xl sm:max-h-[calc(100dvh_-_2rem)] sm:w-[calc(100%_-_2rem)] ${width}`}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[calc(100dvh_-_1rem_-_2px)] flex-col sm:max-h-[calc(100dvh_-_2rem_-_2px)]">
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 break-words">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-gray-500">{description}</p>
            )}
          </div>
          {headerAction && <div className="col-span-2 row-start-2 flex flex-wrap justify-end gap-2">{headerAction}</div>}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="col-start-2 row-start-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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

        {children && <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>}

        {footer && (
          <footer data-validation-footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
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
