import { beforeEach, describe, expect, it, vi } from 'vitest'
const { auth, recoveryAuth } = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), setSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn() },
  recoveryAuth: { getUser: vi.fn(), getSession: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth }, recoverySupabase: { auth: recoveryAuth }, RECOVERY_USER_KEY: 'recovery-user', RECOVERY_RETURN_KEY: 'recovery-return' }))
vi.mock('./client', () => ({ apiFetch: vi.fn() }))
import { cancelPasswordReset, recoveryEmail, requestPasswordReset, resetPassword, verifyResetCode } from './account'

beforeEach(async () => {
  vi.resetAllMocks()
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  vi.stubGlobal('window', { location: { origin: 'https://clinic.example' } })
  auth.getUser.mockResolvedValue({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
  auth.setSession.mockResolvedValue({ error: null })
  recoveryAuth.getUser.mockResolvedValue({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
  recoveryAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery-token', refresh_token: 'refresh-token' } }, error: null })
  recoveryAuth.verifyOtp.mockResolvedValue({ data: { user: { id: 'patient' }, session: { access_token: 'recovery-token' } }, error: null })
  recoveryAuth.updateUser.mockResolvedValue({ error: null })
  recoveryAuth.signOut.mockResolvedValue({ error: null })
  await cancelPasswordReset()
  vi.clearAllMocks()
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
    await verifyResetCode(' Patient@Example.Test ', '123456')
    expect(recoveryAuth.verifyOtp).toHaveBeenCalledWith({ email: 'patient@example.test', token: '123456', type: 'recovery' })
    expect(await recoveryEmail()).toBe('patient@example.test')
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
  })
  it('does not establish recovery state for an expired code', async () => {
    recoveryAuth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })
    await expect(verifyResetCode('patient@example.test', '123456')).rejects.toThrow('expired')
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
  })
  it('clears the recovery marker and signs out locally after changing the password', async () => {
    sessionStorage.setItem('recovery-user', 'patient')
    await resetPassword('NewPassword1!')
    expect(recoveryAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1!' })
    expect(sessionStorage.getItem('recovery-user')).toBeNull()
    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signOut).not.toHaveBeenCalled()
  })
  it('sends recovery emails to the callback on the current site', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    await requestPasswordReset(' Patient@Example.Test ')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('patient@example.test', { redirectTo: 'https://clinic.example/auth/recovery' })
  })
  it('cancels verified recovery without signing out the patient or changing the password', async () => {
    await verifyResetCode('patient@example.test', '123456')
    await cancelPasswordReset()
    expect(await recoveryEmail()).toBeNull()
    await expect(resetPassword('NewPassword1!')).rejects.toThrow('expired')
    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(recoveryAuth.updateUser).not.toHaveBeenCalled()
  })
  it('preserves the patient login after saving a new password from Profile', async () => {
    await verifyResetCode('patient@example.test', '123456')
    await resetPassword('NewPassword1!', true)
    expect(recoveryAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1!' })
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'recovery-token', refresh_token: 'refresh-token' })
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(recoveryAuth.signOut).not.toHaveBeenCalled()
    expect(await recoveryEmail()).toBeNull()
    await cancelPasswordReset()
    expect(recoveryAuth.signOut).not.toHaveBeenCalled()
  })
  it('does not replace another signed-in account with the account being recovered', async () => {
    await verifyResetCode('patient@example.test', '123456')
    auth.getUser.mockResolvedValue({ data: { user: { id: 'other-account' } }, error: null })
    await expect(resetPassword('NewPassword1!', true)).rejects.toThrow('sign-in session has expired')
    expect(recoveryAuth.updateUser).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
  })
  it('ignores a verification response that arrives after cancellation', async () => {
    let finish!: (value: unknown) => void
    recoveryAuth.verifyOtp.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const verifying = verifyResetCode('patient@example.test', '123456')
    await cancelPasswordReset()
    finish({ data: { user: { id: 'patient' }, session: {} }, error: null })
    await expect(verifying).rejects.toThrow('cancelled')
    expect(await recoveryEmail()).toBeNull()
  })
  it('does not restore recovery authorization from an in-flight lookup after cancellation', async () => {
    await verifyResetCode('patient@example.test', '123456')
    let finish!: (value: unknown) => void
    recoveryAuth.getUser.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const checking = recoveryEmail()
    await cancelPasswordReset()
    finish({ data: { user: { id: 'patient', email: 'patient@example.test' } }, error: null })
    expect(await checking).toBeNull()
  })
})

it('keeps a temporary recovery lookup failure distinct from an expired session', async () => {
  sessionStorage.setItem('recovery-user', 'patient')
  recoveryAuth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0 } })
  await expect(recoveryEmail()).rejects.toThrow('connection')
  expect(sessionStorage.getItem('recovery-user')).toBe('patient')
})
