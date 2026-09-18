const BOOKING_STEPS = ['Service', 'Schedule', 'Your details'] as const

export type BookingStep = 0 | 1 | 2

/**
 * Progress across the three booking steps.
 *
 * Completed steps are clickable so a patient can go back and change a service
 * without losing the rest of the form; steps ahead are not, because each one
 * depends on the answer before it — there is no date list until a service is
 * chosen.
 */
export function Stepper({
  current,
  onJump,
}: {
  current: BookingStep
  onJump: (step: BookingStep) => void
}) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Booking progress">
      {BOOKING_STEPS.map((label, index) => {
        const done = index < current
        const active = index === current

        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(index as BookingStep)}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span
                className={`h-1 rounded-full transition-colors ${
                  done || active ? 'bg-brand-500' : 'bg-gray-200'
                }`}
              />
              <span
                className={`truncate text-[11px] font-medium ${
                  active
                    ? 'text-brand-700'
                    : done
                      ? 'text-gray-500'
                      : 'text-gray-400'
                }`}
              >
                {index + 1}. {label}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
