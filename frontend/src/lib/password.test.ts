import { describe, expect, it } from 'vitest'
import { isPasswordChangeReady, meetsPasswordRules } from './password'

describe('meetsPasswordRules', () => {
  it('accepts a password that meets all four rules', () => {
    expect(meetsPasswordRules('HavenCare!2026')).toBe(true)
  })

  it('refuses one that misses any single rule', () => {
    for (const value of [
      'Hc!2026', // 7 characters
      'havencare!2026', // no uppercase
      'HavenCare!care', // no number
      'HavenCare2026', // no special character
    ]) {
      expect(meetsPasswordRules(value), value).toBe(false)
    }
  })
})

describe('isPasswordChangeReady', () => {
  const ready = { current: 'old', next: 'HavenCare!2026', confirm: 'HavenCare!2026' }

  it('is ready when all three are filled and the new one is valid and repeated', () => {
    expect(isPasswordChangeReady(ready)).toBe(true)
  })

  it('is not ready without the current password', () => {
    expect(isPasswordChangeReady({ ...ready, current: '' })).toBe(false)
  })

  it('is not ready when the confirmation differs', () => {
    expect(isPasswordChangeReady({ ...ready, confirm: 'HavenCare!2027' })).toBe(false)
  })

  it('is not ready when the new password breaks a rule', () => {
    expect(
      isPasswordChangeReady({ ...ready, next: 'short', confirm: 'short' }),
    ).toBe(false)
  })
})
