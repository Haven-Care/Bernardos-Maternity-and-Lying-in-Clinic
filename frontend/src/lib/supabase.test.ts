import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-public-key')
  createClient.mockClear().mockImplementation(() => ({ auth: { onAuthStateChange: vi.fn() } }))
  await import('./supabase')
})
afterEach(() => vi.unstubAllEnvs())
type AuthOptions = {
  persistSession: boolean
  autoRefreshToken: boolean
  storageKey?: string
  detectSessionInUrl: (url: URL, params: Record<string, string>) => boolean
}
function options(index: number) { return createClient.mock.calls[index][2].auth as AuthOptions }

describe('portal and recovery session isolation', () => {
  it('keeps temporary recovery credentials out of persisted portal sessions', () => {
    expect(options(0).persistSession).toBe(true)
    expect(options(1).persistSession).toBe(false)
    expect(options(1).autoRefreshToken).toBe(false)
    expect(options(1).storageKey).toBe('havencare:password-recovery')
  })
  it.each(['/login', '/patient/account', '/auth/recovery'])('does not mistake an ordinary %s page load for an authentication callback', (path) => {
    const url = new URL(`https://clinic.example${path}`)
    expect(options(0).detectSessionInUrl(url, {})).toBe(false)
    expect(options(1).detectSessionInUrl(url, {})).toBe(false)
  })
  it('processes recovery credentials only in the temporary client', () => {
    const url = new URL('https://clinic.example/auth/recovery')
    const params = { access_token: 'recovery-token', type: 'recovery' }
    expect(options(0).detectSessionInUrl(url, params)).toBe(false)
    expect(options(1).detectSessionInUrl(url, params)).toBe(true)
  })
  it('keeps OAuth and email confirmation callbacks on the portal client', () => {
    const url = new URL('https://clinic.example/auth/callback')
    expect(options(0).detectSessionInUrl(url, { access_token: 'login-token' })).toBe(true)
    expect(options(1).detectSessionInUrl(url, { access_token: 'login-token' })).toBe(false)
  })
})
