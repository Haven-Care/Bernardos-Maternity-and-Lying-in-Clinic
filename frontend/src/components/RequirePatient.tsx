import { Navigate, Outlet, useLocation } from 'react-router-dom'
import * as api from '../api'
import { useAsync } from '../hooks/useAsync'

/**
 * Route guard for the patient surface.
 *
 * Same posture as `RequireStaff`: **this decides what renders, not what is
 * permitted.** Every `/me/*` handler in Express reads the account id from the
 * token and never from the request, so a patient who edits client state reaches
 * markup and nothing else.
 *
 * The account comes from `/me/account`, which means an expired session or an
 * unconfirmed address fails here the same way it fails everywhere else. There
 * is no client-side "signed in" flag that could disagree with the server — the
 * one that matters is whether the server will answer.
 */
export function RequirePatient() {
  const location = useLocation()
  const account = useAsync(() => api.patientAuth.getAccount())

  if (account.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        Checking your session…
      </div>
    )
  }

  if (account.error || !account.data) {
    return (
      <Navigate
        to="/patient/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}
