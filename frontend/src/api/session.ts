import type { LoginInput, SessionIdentity } from '../types/account'
import { apiFetch } from './client'
import { RECOVERY_USER_KEY, supabase } from '../lib/supabase'
import { isSessionError } from '../lib/api'
import { withTimeout } from '../lib/asyncTimeout'

const AUTH_TIMEOUT = 15_000
const SIGN_IN_TIMEOUT = 'Sign-in took too long. Check your connection and try again.'

export async function getIdentity(): Promise<SessionIdentity> {
  const identity = await withTimeout(apiFetch<SessionIdentity>('/account/session'), AUTH_TIMEOUT, 'We couldn’t check your session in time. Check your connection and try again.')
  if (!identity || !['patient', 'staff', 'administrator'].includes(identity.role)) {
    throw new Error('Unable to verify your account. Please try signing in again.')
  }
  return identity
}

async function clearRejectedSession() {
  // A stalled sign-out must not hide the authorization error behind a spinner.
  await withTimeout(supabase.auth.signOut({ scope: 'local' }), 5_000, SIGN_IN_TIMEOUT).catch(() => undefined)
}

export const googleLoginEnabled = import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true'

export async function loginWithGoogle(credential: string, nonce: string): Promise<SessionIdentity> {
  if (!googleLoginEnabled) throw new Error('Google sign-in is not enabled yet.')
  if (!credential || !nonce) throw new Error('Google sign-in did not return a valid credential.')
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  const { data, error } = await withTimeout(supabase.auth.signInWithIdToken({
    provider: 'google', token: credential, nonce,
  }), AUTH_TIMEOUT, SIGN_IN_TIMEOUT)
  if (error) throw error
  if (!data.session) throw new Error('Google sign-in did not create a session.')
  try { return await getIdentity() }
  catch (error) {
    if (isSessionError(error)) await clearRejectedSession()
    throw error
  }
}

export async function completeOAuthLogin(): Promise<SessionIdentity> {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash?.slice(1))
  if (query.has('error') || hash.has('error')) throw new Error('Sign-in was cancelled. Please try again.')
  // getSession waits for the Auth client to process the callback URL.
  const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT, SIGN_IN_TIMEOUT)
  if (error || !data.session) throw new Error('Sign-in was cancelled or expired. Please try again.')
  try { return await getIdentity() }
  catch (error) {
    if (isSessionError(error)) await clearRejectedSession()
    throw error
  }
}

export async function login(input: LoginInput): Promise<SessionIdentity> {
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email: input.identifier.trim().toLowerCase(), password: input.password }), AUTH_TIMEOUT, SIGN_IN_TIMEOUT)
  if (error) throw error
  if (!data.session) throw new Error('Sign-in did not create a session. Please try again.')
  try { return await getIdentity() }
  catch (error) {
    // A transport failure must not discard an otherwise valid session.
    if (isSessionError(error)) await clearRejectedSession()
    throw error
  }
}
