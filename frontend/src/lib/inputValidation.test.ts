import { describe, expect, it } from 'vitest'
import { calendarInputError, MAX_INTEGER, MAX_MONEY, numberInputError, numericSyntax, patientDocumentError, textInputError } from './inputValidation'

describe('stock and pricing input rules', () => {
  it.each(['aaa', '1e3', '-1', '+2', '1.5', 'Infinity', 'NaN', '1,000'])('rejects %s as a whole-unit quantity', (value) => {
    expect(numericSyntax(value)).toBe(false)
    expect(numberInputError(value, { label: 'Quantity', required: true, min: 1, max: MAX_INTEGER, decimalPlaces: 0 })).toBeDefined()
  })
  it('distinguishes required quantities from optional zero-based thresholds', () => {
    expect(numberInputError('', { label: 'Quantity', required: true, min: 1, max: 10, decimalPlaces: 0 })).toContain('required')
    expect(numberInputError('0', { label: 'Reorder', min: 0, max: MAX_INTEGER, decimalPlaces: 0 })).toBeUndefined()
    expect(numberInputError('11', { label: 'Dispensed', min: 1, max: 10, decimalPlaces: 0 })).toContain('10')
    expect(numberInputError('2147483648', { label: 'Quantity', min: 1, max: MAX_INTEGER, decimalPlaces: 0 })).toBeDefined()
  })
  it('allows centavos while rejecting excess precision and monetary overflow', () => {
    const options = { label: 'Price', min: 0, max: MAX_MONEY, decimalPlaces: 2 }
    for (const value of ['0', '1.50', '0.01', '99999999.99']) expect(numberInputError(value, options)).toBeUndefined()
    for (const value of ['1.501', '100000000', '.', '1e4']) expect(numberInputError(value, options)).toBeDefined()
  })
})
describe('patient and business text fields', () => {
  it('accepts Unicode names and punctuation without allowing whitespace-only or numeric names', () => {
    const options = { label: 'Name', required: true, rule: 'name' as const }
    for (const value of ["Ma. José O'Neil-Santos", '李 明']) expect(textInputError(value, options)).toBeUndefined()
    for (const value of ['  ', '12345', 'A']) expect(textInputError(value, options)).toBeDefined()
  })
  it('allows blank optional fields and preserves multiline clinical notes', () => {
    expect(textInputError('', { label: 'Email', rule: 'email' })).toBeUndefined()
    expect(textInputError('Findings:\nPatient stable.\nFollow up in 2 weeks.', { label: 'Findings', maxLength: 10000 })).toBeUndefined()
    expect(textInputError('Text\u0000hidden', { label: 'Notes' })).toBeDefined()
    expect(textInputError('x'.repeat(201), { label: 'Name' })).toBeDefined()
  })
  it('validates contact formats and rejects executable website schemes', () => {
    expect(textInputError('+63 917 123 4567', { label: 'Mobile', rule: 'mobile' })).toBeUndefined()
    expect(textInputError('(02) 8123-4567', { label: 'Phone', rule: 'phone' })).toBeUndefined()
    expect(textInputError('aaa', { label: 'Phone', rule: 'phone' })).toBeDefined()
    expect(textInputError('www.clinic.example', { label: 'Website', rule: 'website' })).toBeUndefined()
    expect(textInputError('javascript:alert(1)', { label: 'Website', rule: 'website' })).toBeDefined()
    expect(textInputError('wrong@', { label: 'Email', rule: 'email' })).toBeDefined()
  })
  it('keeps lot punctuation while rejecting unsupported or empty references', () => {
    expect(textInputError('LOT#2026_A/1.0', { label: 'Lot', rule: 'lot', maxLength: 64 })).toBeUndefined()
    expect(textInputError('LOT;<script>', { label: 'Lot', rule: 'lot', maxLength: 64 })).toBeDefined()
  })
})
describe('dates and uploads', () => {
  it('rejects impossible dates, future birth dates, and expiry before receipt day', () => {
    expect(calendarInputError('2026-02-30', 'date')).toBeDefined()
    expect(calendarInputError('2027-01-01', 'date', undefined, '2026-10-28')).toBeDefined()
    expect(calendarInputError('2026-10-27', 'date', '2026-10-28')).toBeDefined()
    expect(calendarInputError('2028-02-29', 'date')).toBeUndefined()
  })
  it('rejects empty, oversized, unsupported, and overlong-named patient documents', () => {
    const file = { name: 'scan.pdf', type: 'application/pdf', size: 100 }
    expect(patientDocumentError(file)).toBeUndefined()
    expect(patientDocumentError({ ...file, size: 0 })).toBeDefined()
    expect(patientDocumentError({ ...file, size: 10 * 1024 * 1024 + 1 })).toBeDefined()
    expect(patientDocumentError({ ...file, type: 'text/html' })).toBeDefined()
    expect(patientDocumentError({ ...file, name: 'x'.repeat(256) })).toBeDefined()
  })
})
