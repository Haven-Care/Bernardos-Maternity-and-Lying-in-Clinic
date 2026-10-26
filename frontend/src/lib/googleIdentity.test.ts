import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Google sign-in nonce', () => {
  it('generates fresh 256-bit values and sends their SHA-256 hexadecimal hash to Google', async () => {
    const { createGoogleNonce } = await import('./googleIdentity')
    vi.spyOn(crypto, 'getRandomValues').mockReturnValueOnce(new Uint8Array(32))
    const first = await createGoogleNonce()
    const second = await createGoogleNonce()
    expect(first.nonce).toMatch(/^[0-9a-f]{64}$/)
    expect(first.nonce).not.toBe(second.nonce)
    expect(first.nonce).toBe('00'.repeat(32))
    expect(first.hashedNonce).toBe('60e05bd1b195af2f94112fa7197a5c88289058840ce7c6df9693756bc6250f55')
    expect(first.hashedNonce).not.toBe(first.nonce)
  })
})

function browser() {
  const scripts: Array<{ src?: string; onload?: (() => void) | null; onerror?: (() => void) | null; remove: ReturnType<typeof vi.fn> }> = []
  const windowState = { setTimeout, clearTimeout, google: undefined as unknown }
  vi.stubGlobal('window', windowState)
  vi.stubGlobal('document', {
    createElement: () => ({ remove: vi.fn() }),
    head: { appendChild: (script: typeof scripts[number]) => { scripts.push(script) } },
  })
  return { scripts, windowState }
}

describe('Google SDK loading', () => {
  it('shares the official SDK request across concurrent component mounts', async () => {
    const { scripts, windowState } = browser()
    const { loadGoogleIdentity } = await import('./googleIdentity')
    const first = loadGoogleIdentity()
    const second = loadGoogleIdentity()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://accounts.google.com/gsi/client')
    const identity = { initialize: vi.fn(), renderButton: vi.fn() }
    windowState.google = { accounts: { id: identity } }
    scripts[0].onload!()
    expect(await first).toBe(identity)
    expect(await second).toBe(identity)
    expect(await loadGoogleIdentity()).toBe(identity)
    expect(scripts).toHaveLength(1)
  })
  it('allows a retry after a blocked SDK download', async () => {
    const { scripts } = browser()
    const { loadGoogleIdentity } = await import('./googleIdentity')
    const failed = loadGoogleIdentity()
    const rejection = expect(failed).rejects.toThrow('could not load')
    scripts[0].onerror!()
    await rejection
    expect(scripts[0].remove).toHaveBeenCalled()
    const retry = loadGoogleIdentity()
    const retryRejection = expect(retry).rejects.toThrow('could not load')
    expect(scripts).toHaveLength(2)
    scripts[1].onerror!()
    await retryRejection
  })
  it('times out stalled downloads and allows retry', async () => {
    vi.useFakeTimers()
    const { scripts } = browser()
    const { loadGoogleIdentity } = await import('./googleIdentity')
    const failed = loadGoogleIdentity()
    const rejection = expect(failed).rejects.toThrow('could not load')
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(scripts[0].remove).toHaveBeenCalled()
    const retry = loadGoogleIdentity()
    const retryRejection = expect(retry).rejects.toThrow('could not load')
    expect(scripts).toHaveLength(2)
    scripts[1].onerror!()
    await retryRejection
  })
})
