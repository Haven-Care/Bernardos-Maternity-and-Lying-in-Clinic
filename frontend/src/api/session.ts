import type { LoginInput, SessionIdentity } from '../types/account'
import { apiFetch } from './client'
import { RECOVERY_USER_KEY, supabase } from '../lib/supabase'
import { isSessionError } from '../lib/api'

export function getIdentity(): Promise<SessionIdentity> {
  return apiFetch<SessionIdentity>('/account/session')
}

export const googleLoginEnabled = import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true'

export async function loginWithGoogle(from?: unknown): Promise<void> {
  if (!googleLoginEnabled) throw new Error('Google sign-in is not enabled yet.')
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  const callback = new URL('/auth/callback', window.location.origin)
  if (typeof from === 'string') callback.searchParams.set('next', from)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data.url) throw new Error('Could not start Google sign-in.')
  window.location.assign(data.url)
}

export async function completeOAuthLogin(): Promise<SessionIdentity> {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash?.slice(1))
  if (query.has('error') || hash.has('error')) throw new Error('Google sign-in was cancelled. Please try again.')
  // getSession waits for the Auth client to process the callback URL.
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Google sign-in was cancelled or expired. Please try again.')
  try { return await getIdentity() }
  catch (error) {
    if (isSessionError(error)) await supabase.auth.signOut()
    throw error
  }
}

export async function login(input: LoginInput): Promise<SessionIdentity> {
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  const { error } = await supabase.auth.signInWithPassword({ email: input.identifier.trim().toLowerCase(), password: input.password })
  if (error) throw error
  try { return await getIdentity() }
  catch (error) {
    // A transport failure must not discard an otherwise valid session.
    if (isSessionError(error)) await supabase.auth.signOut()
    throw error
  }
}
