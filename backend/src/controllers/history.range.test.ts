import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listBookings } from './appointments.controller.js'
import { listMovements } from './inventory.controller.js'
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
beforeEach(() => getClient.mockReset())

function setup() {
  const chain = Object.fromEntries(['select', 'order', 'gte', 'lte', 'lt', 'range'].map((name) => [name, vi.fn()]))
  const result = { ...chain, data: [], error: null }
  for (const method of Object.values(chain)) method.mockReturnValue(result)
  getClient.mockReturnValue({ from: vi.fn(() => result) })
  const json = vi.fn()
  return { chain, res: { json } as unknown as Response, json }
}

describe('historical date queries', () => {
  it('filters appointment dates before paginating with stable ordering', async () => {
    const { chain, res, json } = setup()
    await listBookings({ query: { from: '2026-10-01', to: '2026-10-21', offset: '500', limit: '100' } } as unknown as Request, res)
    expect(chain.gte).toHaveBeenCalledWith('scheduled_date', '2026-10-01')
    expect(chain.lte).toHaveBeenCalledWith('scheduled_date', '2026-10-21')
    expect(chain.order).toHaveBeenCalledWith('id')
    expect(chain.range).toHaveBeenCalledWith(500, 599)
    expect(chain.lte.mock.invocationCallOrder[0]).toBeLessThan(chain.range.mock.invocationCallOrder[0])
    expect(json).toHaveBeenCalledWith([])
  })
  it('filters movements by the Manila day rather than truncating to the latest 500 globally', async () => {
    const { chain, res } = setup()
    await listMovements({ query: { from: '2026-10-21', to: '2026-10-21', offset: '500' } } as unknown as Request, res)
    expect(chain.gte).toHaveBeenCalledWith('occurred_at', '2026-10-21T00:00:00+08:00')
    expect(chain.lt).toHaveBeenCalledWith('occurred_at', '2026-10-22T00:00:00+08:00')
    expect(chain.range).toHaveBeenCalledWith(500, 999)
    expect(chain.lt.mock.invocationCallOrder[0]).toBeLessThan(chain.range.mock.invocationCallOrder[0])
  })
  it('rejects a reversed range before querying the database', async () => {
    await expect(listBookings({ query: { from: '2026-10-22', to: '2026-10-21' } } as unknown as Request, {} as Response)).rejects.toThrow('Start date')
    expect(getClient).not.toHaveBeenCalled()
  })
})
