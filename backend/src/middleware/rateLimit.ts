import type { Request } from 'express'
import {
  ipKeyGenerator,
  rateLimit,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit'
import { env, type RateLimitStoreConfig } from '../config/env.js'

/**
 * Limits for the routes anyone on the internet can reach, and for the writes a
 * patient account can make.
 *
 * The staff portal is behind authentication and used by a handful of people on
 * clinic desktops; throttling it would only ever hurt them. The public booking
 * pages are the opposite: open sign-up means "has an account" costs an
 * attacker nothing, so those are the surfaces that get scraped, fuzzed and
 * hammered.
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
 * The limiter itself is exercised in rateLimit.test.ts, against limiters built
 * with this switch off.
 */
const skip = () => env.nodeEnv === 'test'

/**
 * Counters in Upstash Redis, over its REST API.
 *
 * The default store counts in memory, and memory is per serverless instance:
 * Vercel runs several and starts fresh ones cold, so a client spread across
 * them, or arriving after a scale-up, gets a new allowance each time. One
 * shared counter is the only way a limit means what it says.
 *
 * REST rather than a Redis client: nothing to keep open between invocations,
 * and no dependency. Each hit is one HTTPS request, sent as MULTI/EXEC so the
 * window's expiry can never be lost between creating the key and counting it.
 */
export class UpstashStore implements Store {
  readonly localKeys = false
  readonly prefix: string
  private windowMs = 60_000

  constructor(private readonly config: RateLimitStoreConfig, name: string) {
    this.prefix = `havencare:rl:${name}:`
  }

  init(options: Options) {
    this.windowMs = options.windowMs
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const name = this.prefix + key
    const [, hits, ttl] = await this.exec([
      ['SET', name, '0', 'PX', String(this.windowMs), 'NX'],
      ['INCR', name],
      ['PTTL', name],
    ])
    const remaining = Number(ttl) > 0 ? Number(ttl) : this.windowMs
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + remaining) }
  }

  async decrement(key: string) {
    await this.exec([['DECR', this.prefix + key]])
  }

  async resetKey(key: string) {
    await this.exec([['DEL', this.prefix + key]])
  }

  private async exec(commands: string[][]): Promise<unknown[]> {
    const response = await fetch(`${this.config.url}/multi-exec`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      // A slow store must not hold up the request it is counting.
      signal: AbortSignal.timeout(2_000),
    })
    if (!response.ok) throw new Error(`Rate-limit store answered ${response.status}.`)

    const results = (await response.json()) as Array<{ result?: unknown; error?: string }>
    const failed = results.find((entry) => entry.error)
    if (failed) throw new Error(`Rate-limit store refused a command: ${failed.error}`)
    return results.map((entry) => entry.result)
  }
}

if (env.nodeEnv === 'production' && !env.rateLimitStore) {
  console.warn('Rate limits are counted per serverless instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to share them.')
}

/**
 * The signed-in account when there is one, the client's address otherwise.
 *
 * Philippine mobile carriers put many subscribers behind one public address
 * (CGNAT), so an address-keyed write limit makes strangers share an allowance.
 * Once a guard has said who is asking, the account is the fairer key.
 */
export function accountOrIpKey(req: Request): string {
  const id = req.patient?.userId ?? req.staff?.userId
  return id ? `account:${id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`
}

interface LimiterOptions {
  /** Separates this limiter's counters from the others' in the shared store. */
  name: string
  /** Requests allowed per window. */
  limit: number
  windowMs?: number
  /** `account` must be mounted after the guard that identifies the caller. */
  by?: 'ip' | 'account'
}

export function createLimiter({ name, limit, windowMs = 60_000, by = 'ip' }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    store: env.rateLimitStore ? new UpstashStore(env.rateLimitStore, name) : undefined,
    ...(by === 'account' && { keyGenerator: accountOrIpKey }),
    // When the store is unreachable the request goes through. An outage there
    // should not close the booking form, and the database still enforces the
    // per-account booking cap and slot capacity on its own.
    passOnStoreError: true,
    message: { error: 'Too many requests. Please wait a moment and try again.' },
  })
}

/** Browsing services, slots and clinic details before booking. */
export const publicReadLimiter = createLimiter({
  name: 'public-read',
  // Generous: the booking wizard legitimately fetches availability on every
  // date the patient clicks, and a patient comparing a week of dates should
  // never hit this.
  limit: 120,
})

/**
 * Anything a patient account creates or changes.
 *
 * Deliberately tight. Every booking submitted occupies a real slot in a real
 * clinic's day, and a script could fill a week in seconds.
 */
export const accountWriteLimiter = createLimiter({ name: 'account-write', limit: 10, by: 'account' })

/**
 * Resolving who a token belongs to, on every sign-in and page load. Each call
 * is a GoTrue round trip, and nobody is signed in yet, so it is keyed by
 * address and generous enough for a clinic's shared connection.
 */
export const sessionLimiter = createLimiter({ name: 'session', limit: 60 })

/** The readiness check queries the database, so it cannot be free to call. */
export const healthLimiter = createLimiter({ name: 'health', limit: 30 })
