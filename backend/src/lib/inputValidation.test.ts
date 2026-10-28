import { describe, expect, it } from 'vitest'
import { emailAddress, MAX_INTEGER, money, mobileNumber, personName, phoneNumber, recordedDate, text, website, wholeNumber } from './inputValidation.js'

describe('API input boundaries', () => {
  it('rejects numeric strings, nonfinite values, fractions, and database integer overflow', () => {
    for (const value of ['aaa', '5', null, NaN, Infinity, -1, 1.5, MAX_INTEGER + 1]) expect(wholeNumber().safeParse(value).success).toBe(false)
    for (const value of [0, 1, MAX_INTEGER]) expect(wholeNumber().safeParse(value).success).toBe(true)
  })
  it('keeps cents and refuses silently rounded prices', () => {
    for (const value of [0, 1.5, 19.99, 0.29, 99999999.99]) expect(money().safeParse(value).success).toBe(true)
    for (const value of [-1, 0.001, 1.999, 100000000, Infinity]) expect(money().safeParse(value).success).toBe(false)
  })
  it('accepts international names and rejects whitespace, numeric names, and overlong names', () => {
    expect(personName().parse("  José O'Neil-Santos  ")).toBe("José O'Neil-Santos")
    expect(personName().safeParse('李 明').success).toBe(true)
    for (const value of [' ', '123', 'A', 'x'.repeat(201)]) expect(personName().safeParse(value).success).toBe(false)
  })
  it('validates optional phone numbers and required booking mobile numbers', () => {
    for (const value of ['', '(02) 8123-4567', '+63 917 123 4567']) expect(phoneNumber().safeParse(value).success).toBe(true)
    for (const value of ['aaa', '123', '++639171234567']) expect(phoneNumber().safeParse(value).success).toBe(false)
    expect(mobileNumber().safeParse('0917 123 4567').success).toBe(true)
    expect(mobileNumber().safeParse('(02) 8123-4567').success).toBe(false)
  })
  it('rejects invalid email, unsafe website schemes, and hidden control characters', () => {
    expect(emailAddress().safeParse('bad@').success).toBe(false)
    expect(website().safeParse('https://clinic.example/path').success).toBe(true)
    expect(website().safeParse('www.clinic.example').success).toBe(true)
    for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@example.com']) expect(website().safeParse(value).success).toBe(false)
    expect(text(2000).safeParse('Clinical note\nSecond line').success).toBe(true)
    expect(text().safeParse('hidden\u0000value').success).toBe(false)
  })
  it('rejects impossible, future, and out-of-range historical dates', () => {
    for (const value of ['2026-02-30', '2999-01-01', '1800-01-01']) expect(recordedDate().safeParse(value).success).toBe(false)
    expect(recordedDate().safeParse('2000-02-29').success).toBe(true)
  })
})
