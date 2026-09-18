/**
 * Switch, used for Appointment Slots open/blocked and the notification
 * preferences.
 *
 * A real `<button role="switch">` rather than a styled checkbox, so keyboard
 * and screen-reader behaviour come free.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  /** Shown as a tooltip — used for features that ship deliberately disabled. */
  title,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'
        }`}
      />
    </button>
  )
}
