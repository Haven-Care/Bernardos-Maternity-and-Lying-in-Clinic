import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { parseCorsOrigins } from './config/env.js'

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
