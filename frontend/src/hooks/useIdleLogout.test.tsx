// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAST_ACTIVITY_KEY, staffIdleMinutes, useIdleLogout } from './useIdleLogout'

let container: HTMLDivElement
let root: Root
const onIdle = vi.fn()

function Probe({ minutes }: { minutes: number }) {
  useIdleLogout(minutes, onIdle)
  return null
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  onIdle.mockReset()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Probe minutes={20} />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useIdleLogout', () => {
  it('ends the session once, after the idle limit with no input', async () => {
    await act(async () => vi.advanceTimersByTime(19 * 60_000))
    expect(onIdle).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(60_000 + 15_000))
    expect(onIdle).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTime(10 * 60_000))
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('keeps an active user signed in', async () => {
    for (let minute = 0; minute < 40; minute += 5) {
      await act(async () => vi.advanceTimersByTime(5 * 60_000))
      window.dispatchEvent(new KeyboardEvent('keydown'))
    }
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('counts activity in another portal tab', async () => {
    for (let minute = 0; minute < 40; minute += 5) {
      await act(async () => vi.advanceTimersByTime(5 * 60_000))
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    }
    expect(onIdle).not.toHaveBeenCalled()
  })
})

describe('staffIdleMinutes', () => {
  it('defaults to 20 and accepts a positive configured value', () => {
    expect(staffIdleMinutes(undefined)).toBe(20)
    expect(staffIdleMinutes('')).toBe(20)
    expect(staffIdleMinutes('-5')).toBe(20)
    expect(staffIdleMinutes('15')).toBe(15)
  })
})
