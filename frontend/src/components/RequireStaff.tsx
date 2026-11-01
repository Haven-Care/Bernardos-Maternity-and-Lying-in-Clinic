import { Navigate, Outlet, useLocation } from 'react-router-dom'
import * as api from '../api'
import { useAsync } from '../hooks/useAsync'
import { isSessionError } from '../lib/api'
import { ErrorState } from './ui/states'
import { AuthLoadingScreen } from './ui/AuthLoadingScreen'
import { SessionExpiryRedirect, StaffIdleLogout } from './SessionGuards'
import type { StaffRole } from '../types/account'
export function RequireStaff({ role }: { role?: StaffRole }) {
  const location = useLocation()
  const identity = useAsync(() => api.session.getIdentity())
  if (identity.loading) return <AuthLoadingScreen label="Checking your session…" />
  if (identity.error && !isSessionError(identity.error)) return <ErrorState error={identity.error} onRetry={identity.reload} />
  if (identity.error || !identity.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (identity.data.role === 'patient') return <Navigate to="/patient/home" replace />
  if (role && identity.data.role !== role) return <Navigate to="/admin" replace />
  // Nested guards (the administrator-only routes) already sit inside an outer
  // RequireStaff, which runs the session watchers once.
  if (role) return <Outlet />
  return (
    <>
      <SessionExpiryRedirect />
      <StaffIdleLogout />
      <Outlet />
    </>
  )
}
