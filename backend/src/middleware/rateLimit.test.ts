import express, { type RequestHandler } from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The limiters are off under NODE_ENV=test (see `skip`), so these build them
// against an environment where they are on.
const { env } = vi.hoisted(() => ({
  env: { nodeEnv: 'development', rateLimitStore: null as null | { url: string; token: string } },
}))
vi.mock('../config/env.js', () => ({ env }))

import { createLimiter } from './rateLimit.js'

afterEach(() => {
  env.rateLimitStore = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * `x-test-account` stands in for requirePatient, and X-Forwarded-For for the
 * client's address, as it would arrive through Vercel's proxy.
 */
function appWith(limiter: RequestHandler) {
  const app = express()
  app.set('trust proxy', 1)
  app.use((req, _res, next) => {
    const id = req.get('x-test-account')
    if (id) req.patient = { userId: id, email: '', fullName: '', contactNumber: '', signupConsentVersion: null }
    next()
  })
  app.post('/write', limiter, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

const post = (app: express.Express, ip: string, account?: string) => {
  const req = request(app).post('/write').set('X-Forwarded-For', ip)
  return account ? req.set('x-test-account', account) : req
}

describe('rate limiting', () => {
  it('gives each account behind one shared address its own allowance', async () => {
    const app = appWith(createLimiter({ name: 'test', limit: 2, by: 'account' }))

    await post(app, '203.0.113.7', 'patient-a').expect(200)
    await post(app, '203.0.113.7', 'patient-a').expect(200)
    await post(app, '203.0.113.7', 'patient-a').expect(429)
    await post(app, '203.0.113.7', 'patient-b').expect(200)
  })

  it('counts one account across every address it comes from', async () => {
    const app = appWith(createLimiter({ name: 'test', limit: 2, by: 'account' }))

    await post(app, '203.0.113.7', 'patient-a').expect(200)
    await post(app, '198.51.100.2', 'patient-a').expect(200)
    await post(app, '192.0.2.44', 'patient-a').expect(429)
  })

  it('keys anonymous callers by address', async () => {
    const app = appWith(createLimiter({ name: 'test', limit: 1 }))

    await post(app, '203.0.113.7').expect(200)
    await post(app, '203.0.113.7').expect(429)
    await post(app, '198.51.100.2').expect(200)
  })

  it('counts in Upstash, in one transaction, when it is configured', async () => {
    env.rateLimitStore = { url: 'https://example.upstash.io', token: 'test-token' }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: null }, { result: 3 }, { result: 42_000 }]), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const app = appWith(createLimiter({ name: 'test', limit: 10, by: 'account' }))

    const res = await post(app, '203.0.113.7', 'patient-a').expect(200)

    expect(res.headers.ratelimit).toContain('remaining=7')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.upstash.io/multi-exec')
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(init.body)).toEqual([
      ['SET', 'havencare:rl:test:account:patient-a', '0', 'PX', '60000', 'NX'],
      ['INCR', 'havencare:rl:test:account:patient-a'],
      ['PTTL', 'havencare:rl:test:account:patient-a'],
    ])
  })

  it('lets requests through when the shared store is unreachable', async () => {
    env.rateLimitStore = { url: 'https://example.upstash.io', token: 'test-token' }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appWith(createLimiter({ name: 'test', limit: 1, by: 'account' }))

    await post(app, '203.0.113.7', 'patient-a').expect(200)
    await post(app, '203.0.113.7', 'patient-a').expect(200)
  })

  it('treats a refused command as a store failure, not as a count', async () => {
    env.rateLimitStore = { url: 'https://example.upstash.io', token: 'test-token' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: null }, { error: 'ERR value is not an integer' }, { result: 1 }]), { status: 200 }),
    ))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appWith(createLimiter({ name: 'test', limit: 1, by: 'account' }))

    await post(app, '203.0.113.7', 'patient-a').expect(200)
    expect(String(log.mock.calls[0]?.[1])).toContain('refused a command')
  })
})
