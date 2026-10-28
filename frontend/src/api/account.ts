import type {
  ChangePasswordInput,
  NotificationPrefs,
  ProfileInput,
  StaffProfile,
} from '../types/account'
import { apiFetch } from './client'
import { RECOVERY_RETURN_KEY, RECOVERY_USER_KEY, recoverySupabase, supabase } from '../lib/supabase'

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getProfile(): Promise<StaffProfile> {
  return apiFetch<StaffProfile>('/account/me')
}

/**
 * Changing the email here changes the address that signs in, not just the one
 * displayed — the two cannot drift apart, or a password reset would go to the
 * wrong inbox.
 */
export async function updateProfile(
  input: ProfileInput,
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>('/account/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Change password for an authenticated account.
 *
 * `updateUser` does not check the current password — an open session is all it
 * asks for. So the current password is verified by signing in with it first,
 * which is what makes the "Current Password" field on that form mean anything.
 * Without this, anyone who walked up to an unlocked machine could change it.
 */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email

  if (!email) throw new Error('You are not signed in.')

  const { error: reauth } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  })

  if (reauth) throw new Error('Your current password is incorrect.')

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  })

  if (error) throw new Error(error.message)
}

// --- Password reset: email → 6-digit code → new password -------------------

let codeRecoveryUser: string | null = null
let recoveryAttempt = 0
let allowRecoveryCallback = true

/**
 * Sends the six-digit code.
 *
 * The local template emits `{{ .Token }}` for code entry. Hosted projects may
 * use either that template or a recovery link to /auth/recovery.
 *
 * Resolves even for an address with no account. Reporting "no such user" here
 * would let anyone enumerate the clinic's staff addresses.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/auth/recovery` },
  )

  if (error) throw new Error(error.message)
}

/**
 * Exchanges the code for a session.
 *
 * The temporary session can only be used by this recovery flow. The ordinary
 * portal session remains unchanged until a new password is actually saved.
 */
export async function verifyResetCode(
  email: string,
  code: string,
): Promise<void> {
  const attempt = ++recoveryAttempt
  allowRecoveryCallback = false
  const { data, error } = await recoverySupabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  })

  if (attempt !== recoveryAttempt) throw new Error('Password reset was cancelled. Request a new code.')
  if (error || !data.user || !data.session) throw new Error('That code is incorrect or has expired.')
  codeRecoveryUser = data.user.id
}

export async function recoveryEmail(): Promise<string | null> {
  const attempt = recoveryAttempt
  let expectedUser = codeRecoveryUser ?? sessionStorage.getItem(RECOVERY_USER_KEY)
  const isLinkCallback = allowRecoveryCallback && window.location.pathname === '/auth/recovery'
  if (!expectedUser && !isLinkCallback) return null
  const { data, error } = await recoverySupabase.auth.getUser()
  if (attempt !== recoveryAttempt) return null
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new Error('We couldn’t verify your password request. Check your connection and try again.')
  if (!error && data.user && isLinkCallback) {
    // getUser waits for the isolated client to exchange the URL credentials;
    // do not depend on a deferred PASSWORD_RECOVERY event to authorize the form.
    expectedUser = data.user.id
    sessionStorage.setItem(RECOVERY_USER_KEY, expectedUser)
    allowRecoveryCallback = false
  }
  if (error || !data.user || expectedUser !== data.user.id) return null
  return data.user.email ?? null
}

export async function cancelPasswordReset(): Promise<void> {
  recoveryAttempt++
  allowRecoveryCallback = false
  const hadCodeSession = codeRecoveryUser !== null
  const hadLinkSession = sessionStorage.getItem(RECOVERY_USER_KEY) !== null
  codeRecoveryUser = null
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  sessionStorage.removeItem(RECOVERY_RETURN_KEY)
  if (hadCodeSession || hadLinkSession) await recoverySupabase.auth.signOut({ scope: 'local' })
}

export async function resetPassword(newPassword: string, keepSignedIn = false): Promise<void> {
  const attempt = recoveryAttempt
  if (!await recoveryEmail()) throw new Error('Your password request has expired. Request a new verification code.')
  const auth = recoverySupabase.auth
  const expectedUser = codeRecoveryUser ?? sessionStorage.getItem(RECOVERY_USER_KEY)
  if (keepSignedIn) {
    const { data, error } = await supabase.auth.getUser()
    if (error || !expectedUser || data.user?.id !== expectedUser) throw new Error('Your sign-in session has expired. Sign in again before resetting your password from Profile.')
  }
  if (attempt !== recoveryAttempt) throw new Error('Password reset was cancelled. Request a new code.')
  const { error } = await auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
  if (keepSignedIn) {
    // Supabase can revoke the earlier session after a password change. Retain
    // the newly verified session so Profile continues working after saving.
    const { data, error } = await auth.getSession()
    if (error || !data.session) throw new Error('Password changed. Please sign in again with your new password.')
    const { error: sessionError } = await supabase.auth.setSession(data.session)
    if (sessionError) throw new Error('Password changed. Please sign in again with your new password.')
    codeRecoveryUser = null
    sessionStorage.removeItem(RECOVERY_USER_KEY)
    sessionStorage.removeItem(RECOVERY_RETURN_KEY)
    return
  }
  codeRecoveryUser = null
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  sessionStorage.removeItem(RECOVERY_RETURN_KEY)
  await auth.signOut({ scope: 'local' })
}

// --- Preferences -----------------------------------------------------------

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return apiFetch<NotificationPrefs>('/account/notifications')
}

export async function updateNotificationPrefs(
  input: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  return apiFetch<NotificationPrefs>('/account/notifications', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
