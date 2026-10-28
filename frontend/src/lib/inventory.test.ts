import { describe, expect, it } from 'vitest'
import { BATCH_LABELS, batchState, canReceiveStock } from './inventory'
import type { MedicineBatch } from '../types/medicine'
describe('batch availability after quarantine removal', () => {
  it('allows receiving into a formerly held unexpired batch', () => {
    const batch = { id: 'batch', medicineId: 'medicine', batchNo: 'OLD', receivedAt: '2026-01-01', quantity: 7, expiresAt: '2099-01-01', quarantined: true }
    expect(batchState(batch)).toBe('available')
    expect(canReceiveStock(batch)).toBe(true)
    expect(Object.keys(BATCH_LABELS)).not.toContain('quarantined')
  })
  it('keeps expired and disposed batches unavailable for receipts', () => {
    expect(canReceiveStock({ quantity: 7, expiresAt: '2000-01-01' } as MedicineBatch)).toBe(false)
    expect(canReceiveStock({ quantity: 0, expiresAt: '2099-01-01', state: 'disposed' } as MedicineBatch)).toBe(false)
  })
})
