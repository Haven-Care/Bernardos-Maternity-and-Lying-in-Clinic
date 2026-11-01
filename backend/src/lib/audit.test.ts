import type { Request } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getClient, insert } = vi.hoisted(() => ({ getClient: vi.fn(), insert: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
import { audit } from './audit.js'

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null })
  getClient.mockReset().mockReturnValue({ from: () => ({ insert }) })
})
afterEach(() => vi.restoreAllMocks())

describe('audit', () => {
  it('records the staff actor, their role and the request id', async () => {
    const req = { staff: { userId: 's1', role: 'staff' }, requestId: 'req-1' } as unknown as Request
    await audit(req, 'patient.update', { entityId: 'p1', patientId: 'p1', details: { fields: ['allergies'] } })
    expect(insert).toHaveBeenCalledWith({
      actor_id: 's1', actor_role: 'staff', action: 'patient.update', entity_id: 'p1', patient_id: 'p1',
      request_id: 'req-1', details: { fields: ['allergies'] },
    })
  })

  it('records patients as patients and unauthenticated work as the system', async () => {
    await audit({ patient: { userId: 'a1' } } as unknown as Request, 'consent.record')
    await audit({} as unknown as Request, 'settings.update')
    expect(insert.mock.calls[0][0]).toMatchObject({ actor_id: 'a1', actor_role: 'patient' })
    expect(insert.mock.calls[1][0]).toMatchObject({ actor_id: null, actor_role: 'system' })
  })

  it('logs a failed write instead of failing the request', async () => {
    insert.mockResolvedValue({ error: { code: '42501', message: 'permission denied', details: 'Failing row contains (secret)' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(audit({} as unknown as Request, 'patient.view')).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret')
  })
})
