import { describe, expect, it } from 'vitest'
import { loginDestination, loginErrorMessage } from './login'

describe('shared login routing', () => {
  it('routes patient, staff, and administrator to their own home', () => {
    expect(loginDestination('patient')).toBe('/patient/home')
    expect(loginDestination('staff')).toBe('/admin')
    expect(loginDestination('administrator')).toBe('/admin')
  })
  it('preserves a valid destination only for the matching role', () => {
    expect(loginDestination('patient', '/book?step=2')).toBe('/book?step=2')
    expect(loginDestination('staff', '/admin/appointments?tab=calendar')).toBe('/admin/appointments?tab=calendar')
    expect(loginDestination('patient', '/admin/system')).toBe('/patient/home')
    expect(loginDestination('staff', '/patient/account')).toBe('/admin')
  })
  it.each(['https://example.com', '//example.com', '/bookings', '/admin-fake', 12])('rejects an invalid redirect %s', (from) => {
    expect(loginDestination('patient', from)).toBe('/patient/home')
    expect(loginDestination('staff', from)).toBe('/admin')
  })
  it('uses generic credential failures but keeps connection problems distinct', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials' })).toContain('Invalid account')
    expect(loginErrorMessage({ status: 403, message: 'Staff disabled' })).not.toContain('Staff')
    expect(loginErrorMessage(new TypeError('Failed to fetch'))).toContain('connection')
    expect(loginErrorMessage({ code: 'email_not_confirmed' })).toContain('confirm your email')
  })
})
