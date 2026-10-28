import { z } from 'zod'
import { isoDate } from './validate.js'

export const MAX_INTEGER = 2_147_483_647
export const MAX_MONEY = 99_999_999.99
// Control characters are rejected intentionally; tabs and line breaks remain valid.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
export const text = (max = 200) => z.string().trim().max(max, `Use at most ${max} characters.`).refine((value) => !CONTROL_CHARACTERS.test(value), 'Remove unsupported control characters.')
export const personName = () => text().min(2, 'Enter a name with at least two characters.').refine((value) => /\p{L}/u.test(value), 'A name must contain a letter.')
export const emailAddress = () => text(254).email('Enter a valid email address.')
export const phoneNumber = () => text(30).refine((value) => !value || (/^[+\d\s().-]+$/.test(value) && /^\+?\d{7,15}$/.test(value.replace(/[\s().-]/g, ''))), 'Enter a phone number with 7–15 digits.')
export const mobileNumber = () => text(30).refine((value) => /^(\+?63|0)9\d{9}$/.test(value.replace(/[\s()-]/g, '')), 'Enter a Philippine mobile number, e.g. 0917 123 4567.')
export const wholeNumber = () => z.number().int('Enter a whole number.').min(0, 'Value cannot be negative.').max(MAX_INTEGER, `Value cannot exceed ${MAX_INTEGER}.`)
export const money = () => z.number().min(0, 'Price cannot be negative.').max(MAX_MONEY, 'Amount cannot exceed 99,999,999.99.').refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use at most two decimal places.')
export const website = () => text(2048).refine((value) => {
  if (!value) return true
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && /^[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(url.hostname)
  } catch { return false }
}, 'Enter an HTTP or HTTPS website address.')
export const clinicToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
export const recordedDate = () => isoDate().refine((value) => value >= '1900-01-01' && value <= clinicToday(), 'Choose a date from 1900 through today.')
