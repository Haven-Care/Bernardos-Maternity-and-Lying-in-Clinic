import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { createService, listServices, updateService } from './services.controller.js'

vi.mock('../config/supabase.js', () => ({ getSupabaseClient: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

describe('retired generic service', () => {
  it.each(['Other', ' other ', 'OTHER'])('rejects creation of %s before accessing the database', async (name) => {
    const req = { body: { name, category: 'Consultation', price: 100 } } as Request
    await expect(createService(req, {} as Response)).rejects.toThrow('Choose a specific service name.')
    expect(getSupabaseClient).not.toHaveBeenCalled()
  })

  it('rejects renaming a specific service to Other', async () => {
    const req = { params: { id: '5e1c0000-0000-4000-8000-000000000001' }, body: { name: 'Other' } } as unknown as Request
    await expect(updateService(req, {} as Response)).rejects.toThrow('Choose a specific service name.')
    expect(getSupabaseClient).not.toHaveBeenCalled()
  })

  it.each([false, true])('omits legacy Other rows from the service list (staff=%s)', async (staff) => {
    const query = {
      data: [
        { id: 'legacy', name: ' Other ', category: 'Consultation', price: 0, active: true },
        { id: 'specific', name: 'Consultation', category: 'Consultation', price: 200, active: true },
      ],
      error: null,
      eq: vi.fn(),
    }
    query.eq.mockReturnValue(query)
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(query) }) }) }
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)
    const req = { query: {}, ...(staff ? { staff: { role: 'administrator' } } : {}) } as unknown as Request
    const json = vi.fn()
    await listServices(req, { json } as unknown as Response)
    expect(json).toHaveBeenCalledWith([
      { id: 'specific', name: 'Consultation', category: 'Consultation', price: 200, active: true },
    ])
    if (!staff) expect(query.eq).toHaveBeenCalledWith('active', true)
  })
})
