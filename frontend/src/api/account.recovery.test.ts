import { beforeEach, describe, expect, it, vi } from 'vitest'
const { auth } = vi.hoisted(() => ({ auth: { getUser: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn() } }))
vi.mock('../lib/supabase', () => ({ supabase: { auth }, RECOVERY_USER_KEY: 'recovery-user' }))
vi.mock('./client', () => ({ apiFetch: vi.fn() }))
import { recoveryEmail, requestPasswordReset, resetPassword, verifyResetCode } from './account'

beforeEach(() => {
  vi.resetAllMocks()
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  vi.stubGlobal('window', { location: { origin: 'https://clinic.example' } })
  auth.getUser.mockResolvedValue({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

describe('password recovery session', () => {
  it('does not allow an ordinary signed-in session to use the recovery screen', async () => {
    expect(await recoveryEmail()).toBeNull()
    await expect(resetPassword('NewPassword1!')).rejects.toThrow('recovery session has expired')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
  it('does not accept a recovery marker belonging to a different user', async () => {
    sessionStorage.setItem('recovery-user', 'other-user')
    expect(await recoveryEmail()).toBeNull()
  })
  it('only establishes recovery state after the code has been verified', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'patient' } }, error: null })
    await verifyResetCode(' Patient@Example.Test ', '12345678')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'patient@example.test', token: '12345678', type: 'recovery' })
    expect(await recoveryEmail()).toBe('patient@example.test')
  })
  it('does not establish recovery state for an expired code', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })
    await expect(verifyResetCode('patient@example.test', '12345678')).rejects.toThrow('expired')
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
  })
  it('clears the recovery marker and signs out locally after changing the password', async () => {
    sessionStorage.setItem('recovery-user', 'patient')
    await resetPassword('NewPassword1!')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1!' })
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('sends recovery emails to the callback on the current site', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    await requestPasswordReset(' Patient@Example.Test ')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('patient@example.test', { redirectTo: 'https://clinic.example/auth/recovery' })
  })
})

it('keeps a temporary recovery lookup failure distinct from an expired session', async () => {
  sessionStorage.setItem('recovery-user', 'patient')
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0 } })
  await expect(recoveryEmail()).rejects.toThrow('connection')
  expect(sessionStorage.getItem('recovery-user')).toBe('patient')
})
