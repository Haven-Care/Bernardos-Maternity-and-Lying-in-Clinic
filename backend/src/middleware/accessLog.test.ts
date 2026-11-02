import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accessLog } from './accessLog.js'
import { requestId } from './requestId.js'

afterEach(() => vi.restoreAllMocks())

describe('accessLog', () => {
  it('logs the route pattern and status, not the path values or query', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const app = express()
    app.use(requestId, accessLog)
    app.get('/patients/:id', (_req, res) => {
      res.json({})
    })

    await request(app).get('/patients/abc-123?name=Maria').expect(200)

    expect(info).toHaveBeenCalledTimes(1)
    const line = String(info.mock.calls[0][0])
    expect(line).not.toContain('abc-123')
    expect(line).not.toContain('Maria')
    expect(JSON.parse(line)).toMatchObject({ msg: 'request', method: 'GET', route: '/patients/:id', status: 200 })
  })
})
