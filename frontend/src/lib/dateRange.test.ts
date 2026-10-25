import { describe, expect, it } from 'vitest'
import { clinicDate, dateRangeError, validDate, withinDateRange } from './dateRange'

describe('date filters', () => {
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
