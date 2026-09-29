import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'

const app = createApp()

describe('health', () => {
  it('reports liveness without touching the database', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns a JSON error shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope')

    expect(res.status).toBe(404)
    // Every error in this API renders as `{ error }` via errorHandler. The
    // frontend's apiFetch assumes it, so the shape is part of the contract.
    expect(res.body).toHaveProperty('error')
  })
})
