import { afterEach, describe, expect, it, vi } from 'vitest'
import { stackIsUp } from './stack.js'

const saved = { url: process.env.SUPABASE_URL, required: process.env.REQUIRE_DB }

afterEach(() => {
  vi.unstubAllGlobals()
  if (saved.url === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = saved.url
  if (saved.required === undefined) delete process.env.REQUIRE_DB
  else process.env.REQUIRE_DB = saved.required
})

describe('stackIsUp', () => {
  it('never treats a hosted project as the test stack, even when it answers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    process.env.SUPABASE_URL = 'https://camqzzctawwqlwmqqpop.supabase.co'
    delete process.env.REQUIRE_DB

    await expect(stackIsUp()).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails instead of skipping when REQUIRE_DB=1 and the target is hosted', async () => {
    process.env.SUPABASE_URL = 'https://camqzzctawwqlwmqqpop.supabase.co'
    process.env.REQUIRE_DB = '1'

    await expect(stackIsUp()).rejects.toThrow('not a local Supabase stack')
  })

  it('fails instead of skipping when REQUIRE_DB=1 and the local stack is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.REQUIRE_DB = '1'

    await expect(stackIsUp()).rejects.toThrow('not responding')
  })

  it('skips quietly when the local stack is down and the database is optional', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    delete process.env.REQUIRE_DB

    await expect(stackIsUp()).resolves.toBe(false)
  })

  it('reports a healthy local stack as up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'

    await expect(stackIsUp()).resolves.toBe(true)
  })
})
