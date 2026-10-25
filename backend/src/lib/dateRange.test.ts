import { describe, expect, it } from 'vitest'
import { afterClinicDay, datedListQuery } from './dateRange.js'

describe('dated history queries', () => {
  it('allows open bounds while validating order and page size', () => {
    expect(datedListQuery.parse({ from: '2026-10-21' })).toMatchObject({ from: '2026-10-21', offset: 0, limit: 500 })
    expect(datedListQuery.safeParse({ from: '2026-10-22', to: '2026-10-21' }).success).toBe(false)
    expect(datedListQuery.safeParse({ limit: 501 }).success).toBe(false)
    expect(datedListQuery.safeParse({ offset: -1 }).success).toBe(false)
  })
  it('uses Manila midnight rather than a UTC date cutoff', () => {
    expect(new Date(afterClinicDay('2026-10-21')).toISOString()).toBe('2026-10-21T16:00:00.000Z')
  })
})
