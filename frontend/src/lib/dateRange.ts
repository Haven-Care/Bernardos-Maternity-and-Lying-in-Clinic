export interface DateRange { from: string; to: string }

/** A complete, inclusive range, regardless of which endpoint was picked first. */
export function orderedDateRange(first: string, second: string): DateRange {
  return first <= second ? { from: first, to: second } : { from: second, to: first }
}

/** Full Sunday–Saturday weeks, including adjacent-month days. Uses UTC to avoid DST. */
export function calendarDays(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00Z`)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  const count = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7) * 7
  first.setUTCDate(1 - first.getUTCDay())
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(first)
    day.setUTCDate(first.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function dateRangeError(range: DateRange): string | undefined {
  if ((range.from && !validDate(range.from)) || (range.to && !validDate(range.to))) return 'Enter valid dates.'
  if (range.from && range.to && range.from > range.to) return 'Start date must be on or before end date.'
}
export function withinDateRange(date: string, range: DateRange): boolean {
  return !dateRangeError(range) && (!range.from || date >= range.from) && (!range.to || date <= range.to)
}
export function clinicDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}
