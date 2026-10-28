import { describe, expect, it } from 'vitest'
import type { Database } from '../db/types.js'
import { toBatch } from './inventory.js'
type Batch = Database['public']['Tables']['medicine_batches']['Row']
describe('retired quarantine flags', () => {
  it('maps an unexpired legacy held batch to available without exposing retired fields', () => {
    const mapped = toBatch({ quantity: 7, expires_at: '2099-01-01', quarantined: true, quarantine_reason: 'Old hold', closed_reason: null } as Batch)
    expect(mapped.state).toBe('available')
    expect(mapped).not.toHaveProperty('quarantined')
    expect(mapped).not.toHaveProperty('quarantineReason')
  })
  it('still identifies expired and disposed stock', () => {
    expect(toBatch({ quantity: 7, expires_at: '2000-01-01', quarantined: true } as Batch).state).toBe('expired')
    expect(toBatch({ quantity: 0, closed_reason: 'disposed' } as Batch).state).toBe('disposed')
  })
})
