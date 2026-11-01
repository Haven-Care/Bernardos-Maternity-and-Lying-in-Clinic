import { describe, expect, it } from 'vitest'
import { hostedProjectRef, isLocalSupabaseUrl } from './supabaseTarget.js'

describe('isLocalSupabaseUrl', () => {
  it('accepts only loopback hosts', () => {
    for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321']) {
      expect(isLocalSupabaseUrl(url)).toBe(true)
    }
  })

  it('treats hosted, look-alike and malformed URLs as not local', () => {
    for (const url of [
      'https://camqzzctawwqlwmqqpop.supabase.co',
      'https://localhost.example.com',
      'https://127.0.0.1.nip.io',
      'not a url',
      '',
    ]) {
      expect(isLocalSupabaseUrl(url)).toBe(false)
    }
  })
})

describe('hostedProjectRef', () => {
  it('reads the ref from a hosted project URL', () => {
    expect(hostedProjectRef('https://camqzzctawwqlwmqqpop.supabase.co')).toBe('camqzzctawwqlwmqqpop')
  })

  it('returns null for local and foreign hosts', () => {
    expect(hostedProjectRef('http://127.0.0.1:54321')).toBeNull()
    expect(hostedProjectRef('https://supabase.co.evil.example')).toBeNull()
    expect(hostedProjectRef('nonsense')).toBeNull()
  })
})
