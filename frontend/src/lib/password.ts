export interface PasswordRule {
  label: string
  test: (value: string) => boolean
}

/**
 * The rules the prototype lists under every new-password field.
 *
 * One list for sign-up, reset and change, so a password accepted on one screen
 * is never refused on another. Enforced here, in the browser only: GoTrue's own
 * minimum is looser, so these are the effective rules.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Use at least 8 characters', test: (v) => v.length >= 8 },
  {
    label: 'Contains at least one uppercase letter (A–Z)',
    test: (v) => /[A-Z]/.test(v),
  },
  { label: 'Contains at least one number (0–9)', test: (v) => /\d/.test(v) },
  {
    label: 'Contains a special character (! @ # $)',
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
]

export function meetsPasswordRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

/** The three fields of a Change Password form. */
export interface PasswordChange {
  current: string
  next: string
  confirm: string
}

export const EMPTY_PASSWORD_CHANGE: PasswordChange = {
  current: '',
  next: '',
  confirm: '',
}

/**
 * Ready to submit: the current password is filled in, and the new one meets the
 * rules and was typed the same way twice.
 *
 * Whether the current password is *right* is the server's call — see
 * `changePassword`, which re-authenticates with it before updating.
 */
export function isPasswordChangeReady(change: PasswordChange): boolean {
  return (
    change.current !== '' &&
    meetsPasswordRules(change.next) &&
    change.next === change.confirm
  )
}
