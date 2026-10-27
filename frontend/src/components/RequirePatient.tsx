import { Navigate, Outlet, useLocation } from 'react-router-dom'
import * as api from '../api'
import { useAsync } from '../hooks/useAsync'
import { isSessionError } from '../lib/api'
import { ErrorState } from './ui/states'
import { AuthLoadingScreen } from './ui/AuthLoadingScreen'
export function RequirePatient() {
  const location = useLocation()
  const identity = useAsync(() => api.session.getIdentity())
  if (identity.loading) return <AuthLoadingScreen label="Checking your session…" />
  if (identity.error && !isSessionError(identity.error)) return <ErrorState error={identity.error} onRetry={identity.reload} />
  if (identity.error || !identity.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (identity.data.role !== 'patient') return <Navigate to="/admin" replace />
  return <Outlet />
}
