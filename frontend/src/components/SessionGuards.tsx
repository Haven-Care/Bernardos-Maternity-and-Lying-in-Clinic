import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SESSION_EXPIRED_EVENT } from '../lib/api'
import { supabase } from '../lib/supabase'
import { staffIdleMinutes, useIdleLogout } from '../hooks/useIdleLogout'

/**
 * Sends the user to sign in when the API refuses this tab's token mid-session.
 *
 * The route guards check the session when a page opens; this covers the rest
 * of the visit, so a token that expires or is revoked while someone works ends
 * on the sign-in page with a way back, not on a screen of "Try again" errors.
 */
export function SessionExpiryRedirect() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  useEffect(() => {
    const onExpired = () => navigate('/login', { replace: true, state: { from: pathname + search } })
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [navigate, pathname, search])

  return null
}

/** Ends an idle staff session on this device and returns to sign-in. */
export function StaffIdleLogout() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  const onIdle = useCallback(() => {
    void supabase.auth.signOut({ scope: 'local' }).finally(() => {
      navigate('/login', { replace: true, state: { from: pathname + search } })
    })
  }, [navigate, pathname, search])

  useIdleLogout(staffIdleMinutes(), onIdle)
  return null
}
