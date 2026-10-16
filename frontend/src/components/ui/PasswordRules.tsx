import { PASSWORD_RULES } from '../../lib/password'

/**
 * The live checklist under a new-password field.
 *
 * Checked as the user types rather than only on submit — a rule the user can
 * only discover by failing is a rule that gets failed.
 */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value)
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${
              passed ? 'text-success-700' : 'text-gray-400'
            }`}
          >
            <svg
              className="size-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {passed ? (
                <path d="m5 13 4 4L19 7" />
              ) : (
                <circle cx="12" cy="12" r="9" />
              )}
            </svg>
            {/* The colour and icon carry the state visually; this says it. */}
            <span className="sr-only">{passed ? 'Met:' : 'Not met:'}</span>
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
