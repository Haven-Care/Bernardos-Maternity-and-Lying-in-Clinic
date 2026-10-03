import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

/**
 * Limits for the routes anyone on the internet can reach.
 *
 * The staff portal is behind authentication and used by a handful of people on
 * clinic desktops; throttling it would only ever hurt them. The public booking
 * form is the opposite — it is the one surface with no account in front of it,
 * so it is the one that gets scraped, fuzzed, and hammered.
 */

/**
 * Off under test.
 *
 * supertest makes every request from 127.0.0.1, so a suite that books a dozen
 * appointments looks exactly like one client hammering the form — and the
 * limiter cannot tell the difference, which is the point of it. Leaving it on
 * would mean tests failing with 429 in whatever order they happened to run,
 * which teaches nothing and hides real failures behind a flaky one.
 *
 * The limiter itself is exercised against a normally-configured server rather
 * than through this suite; see the note in the routes file.
 */
const skip = () => env.nodeEnv === 'test'

/** Browsing services, slots and clinic details before booking. */
export const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  // Generous: the booking wizard legitimately fetches availability on every
  // date the patient clicks, and a patient comparing a week of dates should
  // never hit this.
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
})

/**
 * Anything that creates something.
 *
 * Deliberately tight. Every booking submitted here occupies a real slot in a
 * real clinic's day, and a script could fill a week in seconds.
 */
export const publicWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
})
