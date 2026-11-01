import { useEffect } from 'react'

/** Shared by every open portal tab, so activity in one keeps the others signed in. */
export const LAST_ACTIVITY_KEY = 'havencare:last-activity'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
const CHECK_EVERY_MS = 15_000
const RECORD_AT_MOST_EVERY_MS = 5_000

/**
 * Minutes of inactivity before a staff session ends: 20 unless the deployment
 * sets VITE_STAFF_IDLE_MINUTES. Front-desk computers are shared, and a portal
 * left open shows every patient record to whoever sits down next.
 */
export function staffIdleMinutes(configured: unknown = import.meta.env.VITE_STAFF_IDLE_MINUTES): number {
  const minutes = Number(configured)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 20
}

function readShared(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0
  } catch {
    return 0
  }
}

function writeShared(at: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
  } catch {
    // Private mode or blocked storage: this tab still times out on its own.
  }
}

/** Calls `onIdle` once, after `minutes` with no input in any portal tab. */
export function useIdleLogout(minutes: number, onIdle: () => void) {
  useEffect(() => {
    const limit = minutes * 60_000
    let last = Date.now()
    let fired = false
    writeShared(last)

    const record = () => {
      const now = Date.now()
      if (now - last < RECORD_AT_MOST_EVERY_MS) return
      last = now
      writeShared(now)
    }

    const check = () => {
      if (fired) return
      if (Date.now() - Math.max(last, readShared()) >= limit) {
        fired = true
        onIdle()
      }
    }

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, record, { passive: true })
    // A laptop lid opened after lunch fires no timer first; check on return.
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, CHECK_EVERY_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, record)
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [minutes, onIdle])
}
