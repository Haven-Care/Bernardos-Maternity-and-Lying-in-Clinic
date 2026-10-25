import { describe, expect, it } from 'vitest'
import { visitActions } from './visits'
describe('visit workflow actions', () => {
  it('allows confirmation while a future slot is reserved', () => {
    expect(visitActions({ status: 'pending', scheduledDate: '2026-10-23', slotTime: '09:00' }, '2026-10-22', '10:00')).toEqual(['confirm'])
  })
  it('allows same-day arrival followed by completion', () => {
    expect(visitActions({ status: 'confirmed', scheduledDate: '2026-10-22', slotTime: '11:00' }, '2026-10-22', '10:00')).toEqual(['arrive'])
    expect(visitActions({ status: 'arrived', scheduledDate: '2026-10-22', slotTime: '09:00' }, '2026-10-22', '10:00')).toEqual(['complete'])
  })
  it('only offers no-show once the appointment time has passed', () => {
    expect(visitActions({ status: 'confirmed', scheduledDate: '2026-10-22', slotTime: '09:00' }, '2026-10-22', '10:00')).toContain('no-show')
    expect(visitActions({ status: 'confirmed', scheduledDate: '2026-10-22', slotTime: '11:00' }, '2026-10-22', '10:00')).not.toContain('no-show')
  })
  it.each(['completed', 'cancelled', 'no_show'] as const)('keeps %s terminal', (status) => {
    expect(visitActions({ status, scheduledDate: '2026-10-22', slotTime: '09:00' }, '2026-10-22', '10:00')).toEqual([])
  })
})
