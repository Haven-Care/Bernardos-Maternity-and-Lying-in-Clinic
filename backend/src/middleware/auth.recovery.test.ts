import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requirePatient } from './auth.js'

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))

function setup(userType?: string, confirmed = true) {
  let account: {
    id: string
    full_name: string
    email: string
    contact_number: string
  } | null = null
  const insert = vi.fn(async (row: NonNullable<typeof account>) => {
    account = row
    return { error: null }
  })
  const from = vi.fn((table: string) => {
    if (table === 'patient_accounts') {
      return {
        insert,
        select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: account, error: null }),
          single: async () => ({ data: account, error: null }),
        }) }),
      }
    }
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }) }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  getClient.mockReturnValue({
    auth: { getUser: async () => ({
      data: { user: {
        id: 'patient-id',
        email: 'patient@example.test',
        email_confirmed_at: confirmed ? '2026-10-17T00:00:00Z' : null,
        app_metadata: userType ? { user_type: userType } : {},
        user_metadata: { full_name: 'Test Patient', contact_number: '09170000000' },
      } },
      error: null,
    }) },
    from,
  })
  const req = {
    get: () => 'Bearer valid-token',
  } as unknown as Request
  const next = vi.fn()
  return { req, next, insert, from }
}

describe('missing patient account recovery', () => {
  beforeEach(() => getClient.mockReset())

  it('creates the missing account for a confirmed patient', async () => {
    const { req, next, insert } = setup()

    await requirePatient(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith()
    expect(insert).toHaveBeenCalledOnce()
    expect(req.patient).toMatchObject({
      userId: 'patient-id',
      fullName: 'Test Patient',
      email: 'patient@example.test',
    })
  })

  it('does not create a patient account for a staff user', async () => {
    const { req, next, insert } = setup('staff')

    await requirePatient(req, {} as Response, next)

    expect(insert).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 })
  })

  it('does not create an account for an unconfirmed user', async () => {
    const { req, next, insert, from } = setup(undefined, false)

    await requirePatient(req, {} as Response, next)

    expect(from).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 })
  })
})
