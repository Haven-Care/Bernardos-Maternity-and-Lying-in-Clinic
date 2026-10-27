import { describe, expect, it } from 'vitest'
import { calendarDays, clinicDate, dateRangeError, orderedDateRange, validDate, withinDateRange } from './dateRange'

describe('date filters', () => {
  it('completes ranges across months, in reverse order, and on a single day', () => {
    expect(orderedDateRange('2026-10-28', '2026-11-02')).toEqual({ from: '2026-10-28', to: '2026-11-02' })
    expect(orderedDateRange('2026-11-02', '2026-10-28')).toEqual({ from: '2026-10-28', to: '2026-11-02' })
    expect(orderedDateRange('2026-10-28', '2026-10-28')).toEqual({ from: '2026-10-28', to: '2026-10-28' })
  })
  it('builds full calendar weeks through leap days and year boundaries', () => {
    const leapMonth = calendarDays('2028-02')
    expect(leapMonth).toContain('2028-02-29')
    expect(leapMonth[0]).toBe('2028-01-30')
    expect(leapMonth.at(-1)).toBe('2028-03-04')
    expect(calendarDays('2026-12').at(-1)).toBe('2027-01-02')
    expect(calendarDays('2026-10')).toHaveLength(35)
  })
  it('uses inclusive dates and allows open-ended filters', () => {
    expect(withinDateRange('2026-10-21', { from: '2026-10-21', to: '2026-10-21' })).toBe(true)
    expect(withinDateRange('2026-10-20', { from: '2026-10-21', to: '' })).toBe(false)
    expect(withinDateRange('2026-10-21', { from: '', to: '2026-10-21' })).toBe(true)
  })
  it('rejects invalid and reversed ranges instead of ignoring them', () => {
    expect(validDate('2026-02-30')).toBe(false)
    expect(validDate('2028-02-29')).toBe(true)
    expect(dateRangeError({ from: '2026-10-22', to: '2026-10-21' })).toBeTruthy()
    expect(withinDateRange('2026-10-21', { from: '2026-10-22', to: '2026-10-21' })).toBe(false)
  })
  it('filters timestamps by the clinic day at the Manila midnight boundary', () => {
    expect(clinicDate('2026-10-20T15:59:59Z')).toBe('2026-10-20')
    expect(clinicDate('2026-10-20T16:00:00Z')).toBe('2026-10-21')
  })
})
