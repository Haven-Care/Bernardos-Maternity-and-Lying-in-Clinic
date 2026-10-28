import { isEmail, isPhMobile } from './validate'

export const MAX_INTEGER = 2_147_483_647
export const MAX_MONEY = 99_999_999.99
export type TextRule = 'text' | 'name' | 'mobile' | 'phone' | 'email' | 'website' | 'lot'
// Control characters are rejected intentionally; tabs and line breaks remain valid.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export function validWebsite(value: string): boolean {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && /^[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(url.hostname)
  } catch { return false }
}
export function validPhone(value: string): boolean {
  return /^[+\d\s().-]+$/.test(value) && /^\+?\d{7,15}$/.test(value.replace(/[\s().-]/g, ''))
}
export function textInputError(value: string, options: { label: string; required?: boolean; minLength?: number; maxLength?: number; rule?: TextRule }): string | undefined {
  const { label, required, minLength = 0, maxLength = 200, rule = 'text' } = options
  const text = value.trim()
  if (!text) return required ? `${label} is required.` : undefined
  if (CONTROL_CHARACTERS.test(value)) return 'Remove unsupported control characters.'
  if (value.length > maxLength) return `Use at most ${maxLength.toLocaleString()} characters.`
  if (text.length < minLength) return `Use at least ${minLength} characters.`
  if (rule === 'name' && (text.length < 2 || !/\p{L}/u.test(text))) return 'Enter a name with at least two characters and a letter.'
  if (rule === 'email' && !isEmail(text)) return 'Enter a valid email address, e.g. name@example.com.'
  if (rule === 'mobile' && !isPhMobile(text)) return 'Enter a Philippine mobile number, e.g. 0917 123 4567 or +63 917 123 4567.'
  if (rule === 'phone' && !validPhone(text)) return 'Enter 7–15 digits; +, spaces, parentheses, dots, and hyphens are allowed.'
  if (rule === 'website' && !validWebsite(text)) return 'Enter a website such as https://example.com.'
  if (rule === 'lot' && (!/^[A-Za-z0-9#_./ -]+$/.test(text) || !/[A-Za-z0-9]/.test(text))) return 'Use letters, numbers, spaces, #, _, ., /, or hyphens for the lot number.'
}
export function numericSyntax(text: string, decimalPlaces = 0): boolean {
  return decimalPlaces === 0 ? /^\d*$/.test(text) : new RegExp(`^\\d*(?:\\.\\d{0,${decimalPlaces}})?$`).test(text)
}
export function numberInputError(text: string, options: { label: string; required?: boolean; min: number; max: number; decimalPlaces: number }): string | undefined {
  if (!text) return options.required ? `${options.label} is required.` : undefined
  if (!numericSyntax(text, options.decimalPlaces) || !Number.isFinite(Number(text)) || text === '.') return options.decimalPlaces ? `Enter a number with at most ${options.decimalPlaces} decimal places.` : 'Enter a whole number using digits only.'
  if (Number(text) < options.min) return `Enter at least ${options.min.toLocaleString()}.`
  if (Number(text) > options.max) return `Enter no more than ${options.max.toLocaleString('en-PH', { maximumFractionDigits: options.decimalPlaces })}.`
}
export function calendarInputError(value: string, type: string, min?: string, max?: string): string | undefined {
  if (!value) return undefined
  if (type === 'time') return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : 'Enter a valid time.'
  const date = value.slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > '9999-12-31') return 'Enter a real calendar date from 1900 onward.'
  if (type === 'datetime-local' && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 'Enter a valid date and time.'
  if (min && value < min) return `Choose ${min} or later.`
  if (max && value > max) return `Choose ${max} or earlier.`
}

export function patientDocumentError(file: Pick<File, 'name' | 'size' | 'type'>): string | undefined {
  if (!file.name.trim() || file.name.length > 255) return 'Use a file name with 1–255 characters.'
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) return 'Choose a JPG, PNG, WebP, HEIC, or PDF file up to 10 MB.'
}
