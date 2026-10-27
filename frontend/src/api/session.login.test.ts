import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { auth, apiFetch } = vi.hoisted(() => ({
  auth: { signInWithPassword: vi.fn(), signOut: vi.fn() }, apiFetch: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth }, RECOVERY_USER_KEY: 'recovery' }))
vi.mock('./client', () => ({ apiFetch }))
vi.mock('../lib/api', () => ({ isSessionError: (error: { status?: number }) => [401, 403, 404].includes(error.status ?? 0) }))
import { getIdentity, login } from './session'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('sessionStorage', { removeItem: vi.fn() })
  auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  apiFetch.mockResolvedValue({ role: 'patient' })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('email sign-in after registration', () => {
  it('normalizes the email and returns the server-verified patient role', async () => {
    expect(await login({ identifier: ' Patient@Example.Test ', password: 'password' })).toEqual({ role: 'patient' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'patient@example.test', password: 'password' })
  })

  it('preserves an email-confirmation error so the login form can explain the next step', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'email_not_confirmed' } })
    await expect(login({ identifier: 'patient@example.test', password: 'password' })).rejects.toMatchObject({ code: 'email_not_confirmed' })
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('does not reuse an old account if sign-in returns no new session', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
    await expect(login({ identifier: 'patient@example.test', password: 'password' })).rejects.toThrow('create a session')
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('stops a stalled authentication request instead of leaving the loading screen stuck', async () => {
    vi.useFakeTimers()
    auth.signInWithPassword.mockReturnValue(new Promise(() => {}))
    const rejection = expect(login({ identifier: 'patient@example.test', password: 'password' })).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(apiFetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds the post-login session lookup and preserves a valid session on connection failure', async () => {
    vi.useFakeTimers()
    apiFetch.mockReturnValue(new Promise(() => {}))
    const rejection = expect(login({ identifier: 'patient@example.test', password: 'password' })).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('does not get stuck signing out after the server rejects the account', async () => {
    vi.useFakeTimers()
    const error = Object.assign(new Error('Account unavailable'), { status: 403 })
    apiFetch.mockRejectedValue(error)
    auth.signOut.mockReturnValue(new Promise(() => {}))
    const rejection = expect(login({ identifier: 'patient@example.test', password: 'password' })).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(5_000)
    await rejection
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

it.each([null, {}, { role: 'unknown' }])('rejects an invalid identity instead of navigating with it (%j)', async (identity) => {
  apiFetch.mockResolvedValue(identity)
  await expect(getIdentity()).rejects.toThrow('verify your account')
})
