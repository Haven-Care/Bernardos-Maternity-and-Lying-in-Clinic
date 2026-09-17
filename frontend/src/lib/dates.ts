/**
 * Calendar-day arithmetic.
 *
 * Lives in `lib/` rather than `mocks/` because the app needs it after the
 * fixtures are deleted — the calendar grid, date filters, and Days Left columns
 * all depend on these regardless of where the data comes from.
 */

export function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * `YYYY-MM-DD` in **local** time.
 *
 * Deliberately not `toISOString().slice(0, 10)`. That converts to UTC first, so
 * local midnight in Manila (UTC+8) formats as the previous day — every
 * appointment date and expiry date in the app would render one day early.
 */
export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Whole days from today until `date`. Negative once past. */
export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`)
  const diff = target.getTime() - today().getTime()
  return Math.round(diff / 86_400_000)
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay()
  // getDay() is 0 for Sunday, so that case walks back six days, not forward.
  return addDays(date, day === 0 ? -6 : 1 - day)
}
