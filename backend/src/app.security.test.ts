import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { parseCorsOrigins, parseRateLimitStore } from './config/env.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('request bodies', () => {
  it('answers malformed JSON with 400 and never logs the body', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"fullName":"Juana Dela Cruz","allergies":"penicillin",')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'The request body is not valid JSON.' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('penicillin')
  })

  it('refuses bodies over the limit with 413', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ note: 'x'.repeat(110_000) }))

    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'The request is too large.' })
  })
})

describe('response headers', () => {
  it('sends security headers and forbids caching API responses', async () => {
    const res = await request(createApp()).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sends every header helmet() would, not only the two checked above', async () => {
    const res = await request(createApp()).get('/api/health')

    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'")
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin')
    expect(res.headers['origin-agent-cluster']).toBe('?1')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
    expect(res.headers['x-download-options']).toBe('noopen')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none')
    expect(res.headers['x-xss-protection']).toBe('0')
  })

  it('tags every response with a request id, reusing a well-formed Vercel id', async () => {
    const own = await request(createApp()).get('/api/health')
    expect(own.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)

    const vercel = await request(createApp()).get('/api/health').set('x-vercel-id', 'sin1::abcd1-1730000000000-0123456789ab')
    expect(vercel.headers['x-request-id']).toBe('sin1::abcd1-1730000000000-0123456789ab')

    const forged = await request(createApp()).get('/api/health').set('x-vercel-id', '<script>alert(1)</script>')
    expect(forged.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('does not reflect the requested path in a 404', async () => {
    const res = await request(createApp()).get('/api/<script>alert(1)</script>')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Route not found.' })
  })
})

describe('CORS', () => {
  it('grants only the listed origins', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://clinic.example, https://havencare-frontend.vercel.app/')
    vi.resetModules()
    const { createApp: createConfiguredApp } = await import('./app.js')
    const app = createConfiguredApp()

    const listed = await request(app).get('/api/health').set('Origin', 'https://havencare-frontend.vercel.app')
    const unlisted = await request(app).get('/api/health').set('Origin', 'https://evil.example')

    expect(listed.headers['access-control-allow-origin']).toBe('https://havencare-frontend.vercel.app')
    expect(unlisted.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('parseCorsOrigins', () => {
  it('splits, trims and normalises entries to bare origins', () => {
    expect(parseCorsOrigins(' https://Clinic.example/ ,http://localhost:6100', 'production')).toEqual([
      'https://clinic.example',
      'http://localhost:6100',
    ])
  })

  it('defaults to the local frontend outside production only', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual(['http://localhost:6100'])
    expect(() => parseCorsOrigins(undefined, 'production')).toThrow('required in production')
    expect(() => parseCorsOrigins(' , ', 'production')).toThrow('required in production')
  })

  it('refuses wildcards, pages and non-URLs', () => {
    expect(() => parseCorsOrigins('*', 'development')).toThrow('"*" is not allowed')
    expect(() => parseCorsOrigins('https://clinic.example/app', 'development')).toThrow('must be an origin')
    expect(() => parseCorsOrigins('clinic.example', 'development')).toThrow('is not a URL')
  })
})

describe('parseRateLimitStore', () => {
  it('is off when neither value is set, so local and test runs count in memory', () => {
    expect(parseRateLimitStore(undefined, undefined)).toBeNull()
    expect(parseRateLimitStore(' ', '')).toBeNull()
  })

  it('needs both values, over https', () => {
    expect(parseRateLimitStore(' https://example.upstash.io/ ', ' token ')).toEqual({ url: 'https://example.upstash.io', token: 'token' })
    expect(() => parseRateLimitStore('https://example.upstash.io', undefined)).toThrow('or neither')
    expect(() => parseRateLimitStore(undefined, 'token')).toThrow('or neither')
    expect(() => parseRateLimitStore('http://example.upstash.io', 'token')).toThrow('must use https')
    expect(() => parseRateLimitStore('example.upstash.io', 'token')).toThrow('is not a URL')
  })
})
