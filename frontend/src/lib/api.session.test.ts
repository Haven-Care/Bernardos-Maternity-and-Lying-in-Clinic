// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { getAccessToken, signOut } = vi.hoisted(() => ({ getAccessToken: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabase', () => ({ getAccessToken, supabase: { auth: { signOut } } }))
import { ApiError, REQUEST_TIMEOUT_MS, SESSION_EXPIRED_EVENT, apiFetch } from './api'

/** A fetch that answers only when aborted, like a server that never replies. */
function hangingFetch() {
  return vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
    // Like fetch itself: a signal aborted before the call rejects at once.
    if (init.signal?.aborted) abort()
    else init.signal?.addEventListener('abort', abort)
  }))
}

beforeEach(() => {
  getAccessToken.mockReset().mockResolvedValue('token-1')
  signOut.mockReset().mockResolvedValue({ error: null })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('apiFetch timeouts', () => {
  it('reports a request with no answer as a timeout, not an endless spinner', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    const pending = apiFetch('/bookings')
    const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('still lets the caller cancel, and says so as an abort', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const controller = new AbortController()
    const pending = apiFetch('/bookings', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('apiFetch session expiry', () => {
  it('forgets a refused token and tells the signed-in area', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Session expired.' }), { status: 401 })))
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(apiFetch('/account/me')).rejects.toBeInstanceOf(ApiError)

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('does nothing to the session when no token was sent', async () => {
    getAccessToken.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(apiFetch('/me/bookings')).rejects.toMatchObject({ status: 401 })

    expect(signOut).not.toHaveBeenCalled()
    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('leaves a forbidden (403) answer to the caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    await expect(apiFetch('/system/staff')).rejects.toMatchObject({ status: 403 })
    expect(signOut).not.toHaveBeenCalled()
  })
})
