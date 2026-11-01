// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut } },
  recoverySupabase: { auth: {} },
  RECOVERY_RETURN_KEY: 'return',
  RECOVERY_USER_KEY: 'user',
}))
import { logout as staffLogout } from './account'
import { logout as patientLogout } from './patientAuth'

beforeEach(() => signOut.mockReset())

describe.each([['staff', staffLogout], ['patient', patientLogout]])('%s logout', (_realm, logout) => {
  it('signs out everywhere when the server can be reached', async () => {
    signOut.mockResolvedValue({ error: null })
    await logout()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith()
  })

  it('still clears this device when the server cannot be told', async () => {
    signOut.mockResolvedValueOnce({ error: new Error('Failed to fetch') }).mockResolvedValueOnce({ error: null })
    await expect(logout()).resolves.toBeUndefined()
    expect(signOut).toHaveBeenLastCalledWith({ scope: 'local' })
  })
})
