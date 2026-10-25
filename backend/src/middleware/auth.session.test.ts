import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionIdentity } from './auth.js'
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
beforeEach(() => getClient.mockReset())

function setup(profile: { role: string; status: string } | null, userType = 'patient', confirmed = true) {
  const getUser = vi.fn(async () => ({ data: { user: { id: 'user', email: 'test@example.test', email_confirmed_at: confirmed ? '2026-10-21' : null, app_metadata: { user_type: userType }, user_metadata: { role: 'administrator' } } }, error: null }))
  getClient.mockReturnValue({ auth: { getUser }, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? profile : { id: 'user', full_name: 'Patient', email: 'test@example.test', contact_number: '' }, error: null }) }) }) }) })
  const req = { get: () => 'Bearer valid' } as unknown as Request
  const json = vi.fn()
  const next = vi.fn()
  return { req, res: { json } as unknown as Response, json, next }
}

describe('server-verified login role', () => {
  it.each(['staff', 'administrator'])('returns active %s from the database', async (role) => {
    const { req, res, json, next } = setup({ role, status: 'active' })
    await getSessionIdentity(req, res, next)
    expect(json).toHaveBeenCalledWith({ role })
    expect(next).not.toHaveBeenCalled()
  })
  it('routes confirmed patients without trusting editable metadata', async () => {
    const { req, res, json } = setup(null)
    await getSessionIdentity(req, res, vi.fn())
    expect(json).toHaveBeenCalledWith({ role: 'patient' })
  })
  it('rejects an inactive staff account instead of falling back to patient', async () => {
    const { req, res, json, next } = setup({ role: 'administrator', status: 'inactive' })
    await getSessionIdentity(req, res, next)
    expect(json).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 })
  })
  it('rejects staff with a missing profile', async () => {
    const { req, res, json, next } = setup(null, 'staff')
    await getSessionIdentity(req, res, next)
    expect(json).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 })
  })
  it('rejects an unconfirmed patient', async () => {
    const { req, res, json, next } = setup(null, 'patient', false)
    await getSessionIdentity(req, res, next)
    expect(json).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 })
  })
})
