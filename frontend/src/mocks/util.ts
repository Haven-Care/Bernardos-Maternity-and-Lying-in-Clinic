/**
 * Fixture plumbing. Deleted along with the rest of `src/mocks/` once every
 * `// BACKEND:` marker in `src/api/` has been swapped for a real call.
 */

/** Simulated round-trip, in milliseconds. */
const LATENCY_MS = 300

let failureRate = 0

/**
 * Fraction of calls that should reject, 0–1.
 *
 * Exposed on `window.__havencare` in dev so error states can be exercised from
 * the console without a rebuild:
 *
 *   __havencare.setMockFailureRate(1)   // every call fails
 *   __havencare.setMockFailureRate(0)   // back to normal
 *
 * Build the error state when you build the screen. Discovering you never wrote
 * one during a demo is the failure mode this exists to prevent.
 */
export function setMockFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1)
}

// `typeof window` guard: this module is also imported under Node by the test
// runner, where there is no DOM.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__havencare = {
    setMockFailureRate,
  }
}

import { addDays, isoDate, today } from '../lib/dates'

export class MockApiError extends Error {
  constructor(message = 'Simulated network failure') {
    super(message)
    this.name = 'MockApiError'
  }
}

/**
 * Resolve `value` after a realistic delay.
 *
 * Every fixture read goes through this. Without it you build screens that never
 * show a spinner, and they all break the day real latency arrives.
 *
 * The value is deep-cloned so callers can't mutate the fixtures by accident —
 * only the explicit mutators in each fixture module should do that.
 */
export function mockDelay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (failureRate > 0 && Math.random() < failureRate) {
        reject(new MockApiError())
        return
      }
      resolve(structuredClone(value))
    }, ms)
  })
}

/** Reject after a delay — for exercising a specific screen's error path. */
export function mockReject(message: string, ms = LATENCY_MS): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new MockApiError(message)), ms)
  })
}

let counter = 0
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${counter.toString().padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Dates
//
// The primitives live in `lib/dates` because the app needs them after the
// fixtures are deleted. What's here is fixture-specific: everything is
// generated relative to *today*, never hardcoded, because fixed past dates
// would render every batch as expired and every appointment as historical —
// Expiring Soon, Days Left, and Today's Schedule would all demo as empty.
// ---------------------------------------------------------------------------

export { addDays, daysUntil, isoDate, today } from '../lib/dates'

/** `YYYY-MM-DD` for a date offset from today. */
export function daysFromToday(days: number): string {
  return isoDate(addDays(today(), days))
}

/** Full ISO timestamp for a date offset from today, at a given wall clock. */
export function timestampFromToday(days: number, time = '09:00'): string {
  const [h, m] = time.split(':').map(Number)
  const d = addDays(today(), days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
