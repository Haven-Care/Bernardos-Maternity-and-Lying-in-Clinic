import { Navigate, Outlet, useLocation } from 'react-router-dom'
import * as api from '../api'
import { useAsync } from '../hooks/useAsync'
import type { StaffRole } from '../types/account'

/**
 * Route guard for the staff portal.
 *
 * **This is convenience, not security.** It decides what to render, and
 * anything it renders still gets its data from an API that checks the same
 * things again on every request. A determined person can edit client state and
 * reach the markup; they still cannot read a patient record, because
 * `requireStaff` in Express is what actually holds the line.
 *
 * What it buys is that a signed-out visitor sees the login page instead of a
 * portal full of failed requests.
 *
 * The profile comes from `/account/me`, so an expired session or a deactivated
 * account fails here exactly as it fails everywhere else — there is no separate
 * client-side notion of "signed in" that could disagree with the server.
 */
export function RequireStaff({ role }: { role?: StaffRole }) {
  const location = useLocation()
  const profile = useAsync(() => api.account.getProfile())

  if (profile.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        Checking your session…
      </div>
    )
  }

  if (profile.error || !profile.data) {
    // `state` lets the login screen send them back where they were aiming,
    // rather than dropping everyone on the dashboard.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && profile.data.role !== role) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
