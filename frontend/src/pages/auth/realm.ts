import { useLocation } from 'react-router-dom'

/**
 * Which set of auth screens the visitor is standing in.
 *
 * Staff and patients share one `auth.users` table and one password-reset
 * mechanism — the GoTrue calls in `api/account.ts` are realm-agnostic, and a
 * recovery code works the same for both. What differs is only where the screens
 * point: a patient who clicks "Back to login" must not land on the staff portal
 * login, and a patient who finishes a reset should return to `/patient/login`.
 *
 * So the reset sequence is mounted twice in the router and reads its realm from
 * the path rather than being duplicated as four near-identical components. The
 * alternative was eight files differing by two strings each.
 */
export interface AuthRealm {
  isPatient: boolean
  loginPath: string
  forgotPath: string
  verifyPath: string
  resetPath: string
  successPath: string
  /** Where a successful sign-in lands when there is no `from` to return to. */
  homePath: string
}

const STAFF: AuthRealm = {
  isPatient: false,
  loginPath: '/login',
  forgotPath: '/forgot-password',
  verifyPath: '/verify-code',
  resetPath: '/reset-password',
  successPath: '/reset-success',
  homePath: '/admin',
}

const PATIENT: AuthRealm = {
  isPatient: true,
  loginPath: '/patient/login',
  forgotPath: '/patient/forgot-password',
  verifyPath: '/patient/verify-code',
  resetPath: '/patient/reset-password',
  successPath: '/patient/reset-success',
  homePath: '/patient/bookings',
}

export function useAuthRealm(): AuthRealm {
  return useLocation().pathname.startsWith('/patient') ? PATIENT : STAFF
}
