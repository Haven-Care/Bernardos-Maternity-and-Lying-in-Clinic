import { describe, expect, it } from 'vitest'
import { addDays, daysFromToday, daysUntil, isoDate, today } from './util'

describe('isoDate', () => {
  /**
   * The clinic is in Manila (UTC+8). `toISOString().slice(0, 10)` converts to
   * UTC first, so local midnight formats as the *previous* day — which would
   * shift every appointment date and expiry date in the app back by one.
   *
   * This asserts the local-time formatting directly, independent of the
   * machine's zone, so the regression can't return unnoticed.
   */
  it('formats in local time, not UTC', () => {
    // Local midnight on a fixed date.
    const date = new Date(2026, 8, 17)

    expect(isoDate(date)).toBe('2026-09-17')
  })

  it('pads single-digit months and days', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('day arithmetic round-trips', () => {
  it('daysUntil inverts daysFromToday', () => {
    for (const offset of [-30, -1, 0, 1, 5, 30, 400]) {
      expect(daysUntil(daysFromToday(offset))).toBe(offset)
    }
  })

  it('survives a DST-style boundary without drifting', () => {
    // addDays walks calendar days, so a 400-day span stays exact even if the
    // local zone shifts partway through.
    const start = today()
    expect(daysUntil(isoDate(addDays(start, 400)))).toBe(400)
  })
})
