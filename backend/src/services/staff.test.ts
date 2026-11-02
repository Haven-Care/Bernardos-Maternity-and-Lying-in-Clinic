import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))

import { createStaffAccount, touchLastLogin } from './staff.js'

const input = { email: 'new.staff@example.test', password: 'long-enough-password', fullName: 'New Staff', contactNumber: '', role: 'staff' as const }

function setup(profileResult: { data: unknown; error: unknown }) {
  const auth = {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }
  const profiles = { select: () => profiles, eq: () => profiles, maybeSingle: vi.fn().mockResolvedValue(profileResult) }
  getClient.mockReturnValue({ auth: { admin: auth }, from: () => profiles })
  return auth
}

beforeEach(() => {
  getClient.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('createStaffAccount', () => {
  it('removes the auth user when no profile was created for it', async () => {
    const auth = setup({ data: null, error: null })
    await expect(createStaffAccount(input)).rejects.toMatchObject({ status: 500 })
    expect(auth.deleteUser).toHaveBeenCalledWith('new-user')
  })

  it('removes the auth user when the profile could not be read', async () => {
    const auth = setup({ data: null, error: { code: 'XX000', message: 'timeout', details: '', hint: '' } })
    await expect(createStaffAccount(input)).rejects.toMatchObject({ status: 500 })
    expect(auth.deleteUser).toHaveBeenCalledWith('new-user')
  })

  it('reports the original failure even if the clean-up fails too', async () => {
    const auth = setup({ data: null, error: null })
    auth.deleteUser.mockRejectedValue(new Error('network down'))
    await expect(createStaffAccount(input)).rejects.toMatchObject({ message: expect.stringContaining('could not be completed') })
  })
})

describe('touchLastLogin', () => {
  it('never throws, so a failed bookkeeping write cannot fail a sign-in', async () => {
    getClient.mockReturnValue({ from: () => ({ update: () => ({ eq: vi.fn().mockRejectedValue(new Error('aborted')) }) }) })
    await expect(touchLastLogin('user')).resolves.toBeUndefined()

    getClient.mockReturnValue({ from: () => ({ update: () => ({ eq: vi.fn().mockResolvedValue({ error: { code: 'XX000', message: 'boom' } }) }) }) })
    await expect(touchLastLogin('user')).resolves.toBeUndefined()
  })
})
