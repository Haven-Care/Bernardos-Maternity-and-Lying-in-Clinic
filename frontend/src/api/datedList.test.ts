import { beforeEach, describe, expect, it, vi } from 'vitest'
const { fetchPage } = vi.hoisted(() => ({ fetchPage: vi.fn() }))
vi.mock('./client', () => ({ apiFetch: fetchPage }))
import { datedList } from './pagination'
beforeEach(() => fetchPage.mockReset())

describe('date-filtered history pagination', () => {
  it('loads records beyond the first 500 and preserves date bounds', async () => {
    fetchPage.mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: String(index) }))).mockResolvedValueOnce([{ id: '500' }])
    const result = await datedList('/bookings', { from: '2026-10-01', to: '2026-10-21' })
    expect(result).toHaveLength(501)
    expect(fetchPage).toHaveBeenLastCalledWith('/bookings?offset=500&limit=500&from=2026-10-01&to=2026-10-21')
  })
  it('fails visibly rather than looping or silently truncating when an old API ignores pagination', async () => {
    fetchPage.mockResolvedValue(Array.from({ length: 500 }, (_, index) => ({ id: String(index) })))
    await expect(datedList('/bookings')).rejects.toThrow('full history')
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})
