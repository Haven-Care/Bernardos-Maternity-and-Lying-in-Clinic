import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { afterClinicDay } from '../lib/dateRange.js'
import { getStats, rangeQuerySchema } from './dashboard.controller.js'
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
beforeEach(() => getClient.mockReset())

describe('custom dashboard range', () => {
  it.each([
    { range: 'custom' },
    { range: 'custom', from: '2026-10-22', to: '2026-10-21' },
    { range: 'custom', from: '2026-02-30', to: '2026-03-01' },
  ])('rejects missing, reversed, or invalid dates: %j', (query) => {
    expect(rangeQuerySchema.safeParse(query).success).toBe(false)
  })
  it('keeps one-day custom ranges valid', () => {
    expect(rangeQuerySchema.safeParse({ range: 'custom', from: '2026-10-21', to: '2026-10-21' }).success).toBe(true)
  })
  it('uses an exclusive Manila end boundary across month and leap-year edges', () => {
    expect(afterClinicDay('2026-10-31')).toBe('2026-11-01T00:00:00+08:00')
    expect(afterClinicDay('2028-02-29')).toBe('2028-03-01T00:00:00+08:00')
  })
  it('counts with exact HEAD queries and keeps inventory alerts current', async () => {
    const chains: Array<Record<string, ReturnType<typeof vi.fn>>> = []
    getClient.mockReturnValue({
      from: vi.fn(() => {
        const chain = Object.fromEntries(['select', 'gte', 'lte', 'lt', 'eq', 'neq'].map((name) => [name, vi.fn()]))
        const result = { ...chain, count: [5, 9, 3][chains.length], error: null }
        for (const method of Object.values(chain)) method.mockReturnValue(result)
        chains.push(chain)
        return result
      }),
      rpc: vi.fn(async () => ({ data: [{ inventory_alerts: 4 }], error: null })),
    })
    const json = vi.fn()
    await getStats({ query: { range: 'custom', from: '2026-10-01', to: '2026-10-21' } } as unknown as Request, { json } as unknown as Response)
    expect(json).toHaveBeenCalledWith({ todaysSchedule: 5, bookedToday: 9, completedAppointments: 3, inventoryAlerts: 4 })
    expect(chains[0].select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(chains[1].gte).toHaveBeenCalledWith('submitted_at', '2026-10-01T00:00:00+08:00')
    expect(chains[1].lt).toHaveBeenCalledWith('submitted_at', '2026-10-22T00:00:00+08:00')
  })
})
