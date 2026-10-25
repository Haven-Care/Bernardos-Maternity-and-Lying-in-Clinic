export interface DateRange { from: string; to: string }

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
