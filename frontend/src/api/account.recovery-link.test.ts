import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, recoveryAuth } = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), signOut: vi.fn(), setSession: vi.fn() },
  recoveryAuth: { getUser: vi.fn(), signOut: vi.fn(), updateUser: vi.fn(), getSession: vi.fn() },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth }, recoverySupabase: { auth: recoveryAuth }, RECOVERY_USER_KEY: 'recovery-user', RECOVERY_RETURN_KEY: 'recovery-return' }))
vi.mock('./client', () => ({ apiFetch: vi.fn() }))
let account: typeof import('./account')
beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  vi.stubGlobal('window', { location: { pathname: '/auth/recovery' } })
  recoveryAuth.getUser.mockResolvedValue({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
  recoveryAuth.signOut.mockResolvedValue({ error: null })
  account = await import('./account')
})

describe('recovery email callbacks', () => {
  it('waits for isolated URL authentication before establishing recovery authorization', async () => {
    let finish!: (value: unknown) => void
    recoveryAuth.getUser.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const email = account.recoveryEmail()
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
    finish({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
    expect(await email).toBe('patient@example.test')
    expect(sessionStorage.getItem('recovery-user')).toBe('patient')
    expect(auth.getUser).not.toHaveBeenCalled()
  })
  it('does not revive an email-link reset after cancellation', async () => {
    await account.recoveryEmail()
    await account.cancelPasswordReset()
    expect(await account.recoveryEmail()).toBeNull()
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(recoveryAuth.updateUser).not.toHaveBeenCalled()
  })
  it('rejects an invalid link without using or clearing the existing portal login', async () => {
    recoveryAuth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
    expect(await account.recoveryEmail()).toBeNull()
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
  })
})
