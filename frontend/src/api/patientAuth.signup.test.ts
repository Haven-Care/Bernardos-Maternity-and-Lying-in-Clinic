import { afterEach, expect, it, vi } from 'vitest'
const { auth } = vi.hoisted(() => ({ auth: { signUp: vi.fn() } }))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('./client', () => ({}))
vi.mock('../lib/api', () => ({ ApiError: class extends Error {} }))
import { signUp } from './patientAuth'
import { PRIVACY_NOTICE_VERSION } from '../types/privacy'

afterEach(() => { vi.unstubAllGlobals() })

it('returns email confirmations to the app callback on the current site', async () => {
  vi.stubGlobal('window', { location: { origin: 'https://clinic.example' } })
  auth.signUp.mockResolvedValue({ error: null })
  await signUp({ fullName: ' Patient ', email: ' Patient@Example.Test ', contactNumber: '09170000000', password: 'Password123!', acceptedPrivacyNotice: true })
  expect(auth.signUp).toHaveBeenCalledWith({
    email: 'patient@example.test', password: 'Password123!',
    options: {
      emailRedirectTo: 'https://clinic.example/auth/callback',
      data: { full_name: 'Patient', contact_number: '09170000000', privacy_notice_version: PRIVACY_NOTICE_VERSION },
    },
  })
})

it('sends nothing until the privacy notice is accepted', async () => {
  auth.signUp.mockClear()
  await expect(signUp({ fullName: 'Patient', email: 'patient@example.test', contactNumber: '09170000000', password: 'Password123!', acceptedPrivacyNotice: false }))
    .rejects.toThrow('Privacy Notice')
  expect(auth.signUp).not.toHaveBeenCalled()
})
