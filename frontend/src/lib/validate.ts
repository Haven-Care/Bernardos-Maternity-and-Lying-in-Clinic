/**
 * Field validation for the public booking form.
 *
 * In `lib/` rather than inside the form because the backend phase has to restate
 * these same rules in Zod — a patient can always POST past the browser. Keeping
 * them named and in one place means the two can be compared rather than
 * rediscovered, and it is the client-side half of that pair that gets deleted if
 * they ever disagree.
 */

/**
 * Deliberately permissive. The only thing a stricter regex buys is rejecting
 * addresses that are in fact valid; delivery is the real test, and staff phone
 * the patient anyway.
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/**
 * Philippine mobile number.
 *
 * Accepts `09XXXXXXXXX`, `+639XXXXXXXXX`, and `639XXXXXXXXX`, with any spacing,
 * dashes, or parentheses — the clinic's own records are written as
 * `0969 213 2286`, and patients type it every way there is. Landlines are
 * rejected on purpose: the reminder in Limitation 2 is an SMS.
 */
export function isPhMobile(value: string): boolean {
  return /^(\+?63|0)9\d{9}$/.test(value.replace(/[\s()-]/g, ''))
}

/**
 * Normalise to the clinic's own house format, `0969 213 2286`.
 *
 * Run on submit, not on keystroke — reformatting under the cursor fights
 * anyone mid-edit. Input that doesn't parse is returned trimmed rather than
 * mangled, since `isPhMobile` is what decides whether it is allowed through.
 */
export function formatPhMobile(value: string): string {
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('63') ? `0${digits.slice(2)}` : digits
  if (local.length !== 11) return value.trim()
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}
