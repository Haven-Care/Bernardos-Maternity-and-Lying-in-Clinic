import { expect, it } from 'vitest'
import { apiBaseUrl } from './apiBase'
it.each(['havencare-frontend-ruddy.vercel.app', 'bernardo-clinic.vercel.app', 'preview-team.vercel.app'])('keeps %s on the deployed same-origin API proxy', (hostname) => {
  expect(apiBaseUrl(hostname, 'http://localhost:6101/api')).toBe('/api')
})
it('keeps local and custom-domain configuration explicit', () => {
  expect(apiBaseUrl('localhost')).toBe('http://localhost:6101/api')
  expect(apiBaseUrl('127.0.0.1', 'http://127.0.0.1:6111/api')).toBe('http://127.0.0.1:6111/api')
  expect(apiBaseUrl('clinic.example', '/api')).toBe('/api')
})
