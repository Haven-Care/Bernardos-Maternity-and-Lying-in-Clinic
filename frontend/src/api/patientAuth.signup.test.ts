import { afterEach, expect, it, vi } from 'vitest'
const { auth } = vi.hoisted(() => ({ auth: { signUp: vi.fn() } }))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('./client', () => ({}))
vi.mock('../lib/api', () => ({ ApiError: class extends Error {} }))
import { signUp } from './patientAuth'

afterEach(() => { vi.unstubAllGlobals() })

it('returns email confirmations to the app callback on the current site', async () => {
  vi.stubGlobal('window', { location: { origin: 'https://clinic.example' } })
  auth.signUp.mockResolvedValue({ error: null })
  await signUp({ fullName: ' Patient ', email: ' Patient@Example.Test ', contactNumber: '09170000000', password: 'Password1!' })
  expect(auth.signUp).toHaveBeenCalledWith({
    email: 'patient@example.test', password: 'Password1!',
    options: { emailRedirectTo: 'https://clinic.example/auth/callback', data: { full_name: 'Patient', contact_number: '09170000000' } },
  })
})
