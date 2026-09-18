import { describe, expect, it } from 'vitest'
import { formatPhMobile, isEmail, isPhMobile } from './validate'

describe('isPhMobile', () => {
  it('accepts the formats a patient actually types', () => {
    for (const value of [
      '09691232286',
      '0969 123 2286',
      '0969-123-2286',
      '+639691232286',
      '+63 969 123 2286',
      '639691232286',
    ]) {
      expect(isPhMobile(value), value).toBe(true)
    }
  })

  it('rejects landlines and wrong-length numbers', () => {
    for (const value of [
      '(02) 8123 4567', // the clinic's own landline
      '0969123228', // one digit short
      '096912322866', // one digit long
      '08691232286', // not a 09 mobile prefix
      '',
    ]) {
      expect(isPhMobile(value), value).toBe(false)
    }
  })
})

describe('formatPhMobile', () => {
  it('normalises every accepted format to the clinic’s house style', () => {
    for (const value of ['09691232286', '+639691232286', '0969-123-2286']) {
      expect(formatPhMobile(value), value).toBe('0969 123 2286')
    }
  })

  it('returns unparseable input trimmed rather than mangled', () => {
    expect(formatPhMobile('  call me  ')).toBe('call me')
  })
})

describe('isEmail', () => {
  it('accepts ordinary addresses and rejects obvious non-addresses', () => {
    expect(isEmail('juana@gmail.com')).toBe(true)
    expect(isEmail('  juana.delacruz@havencare.ph  ')).toBe(true)
    expect(isEmail('juana@gmail')).toBe(false)
    expect(isEmail('juana at gmail.com')).toBe(false)
    expect(isEmail('')).toBe(false)
  })
})
