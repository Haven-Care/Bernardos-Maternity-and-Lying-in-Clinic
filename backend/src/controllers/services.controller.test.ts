import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { createService, listServices, updateService } from './services.controller.js'
import { toService } from '../mappers/clinic.js'
import type { Database } from '../db/types.js'

vi.mock('../config/supabase.js', () => ({ getSupabaseClient: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

describe('service pricing', () => {
  it('preserves an unspecified price instead of converting null to zero', () => {
    const row: Database['public']['Tables']['services']['Row'] = {
      id: 'norifam', name: 'Norifam', category: 'Family planning', price: null,
      active: true, price_is_temporary: false, created_at: '', updated_at: '',
    }
    expect(toService(row)).toEqual({
      id: 'norifam', name: 'Norifam', category: 'Family planning', price: null, active: true,
    })
  })

  it('accepts a null price when creating a service', async () => {
    const input = { name: 'Norifam', category: 'Family planning', price: null }
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { ...input, id: 'norifam', active: true }, error: null }),
    }) })
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn().mockReturnValue({ insert }) } as unknown as ReturnType<typeof getSupabaseClient>)
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    await createService({ body: input } as Request, { status } as unknown as Response)
    expect(insert).toHaveBeenCalledWith(input)
    expect(status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith({ ...input, id: 'norifam', active: true })
  })
})

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
