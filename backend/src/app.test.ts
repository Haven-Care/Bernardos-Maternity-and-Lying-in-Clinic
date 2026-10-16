import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { Response } from 'express'
import { createApp } from './app.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('deployment configuration', () => {
  it.each(['1', undefined])('handles forwarded IPs with VERCEL=%s', async (vercel) => {
    vi.stubEnv('VERCEL', vercel)
    const app = createApp()
    let clientIp: string | undefined
    const json = app.response.json
    vi.spyOn(app.response, 'json').mockImplementation(function (this: Response, body) {
      clientIp = this.req.ip
      return json.call(this, body)
    })

    const res = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.10')

    expect(res.status).toBe(200)
    if (vercel === '1') {
      // Only the nearest forwarded address is trusted, not an arbitrary prefix.
      expect(clientIp).toBe('203.0.113.10')
    } else {
      expect(['127.0.0.1', '::ffff:127.0.0.1', '::1']).toContain(clientIp)
    }
  })

  it('allows the configured frontend origin in preflight responses', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://havencare-frontend.vercel.app')
    // env reads CORS_ORIGIN at module load, as it does in a fresh deployment.
    vi.resetModules()
    const { createApp: createConfiguredApp } = await import('./app.js')
    const res = await request(createConfiguredApp())
      .options('/api/bookings')
      .set('Origin', 'https://havencare-frontend.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('https://havencare-frontend.vercel.app')
    expect(res.headers['access-control-allow-headers']).toBe('authorization,content-type')
  })
})
