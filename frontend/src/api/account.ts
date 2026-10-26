import type {
  ChangePasswordInput,
  NotificationPrefs,
  ProfileInput,
  StaffProfile,
} from '../types/account'
import { apiFetch } from './client'
import { RECOVERY_USER_KEY, supabase } from '../lib/supabase'

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

// --- Password reset: email → 8-digit code → new password -------------------

/**
 * Sends the eight-digit code.
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
 * On success the user is signed in — a recovery OTP is a login — which is what
 * lets `resetPassword` below call `updateUser` on the next screen.
 */
export async function verifyResetCode(
  email: string,
  code: string,
): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  })

  if (error || !data.user) throw new Error('That code is incorrect or has expired.')
  sessionStorage.setItem(RECOVERY_USER_KEY, data.user.id)
}

export async function recoveryEmail(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new Error('Unable to verify your recovery session. Check your connection and try again.')
  if (error || !data.user || sessionStorage.getItem(RECOVERY_USER_KEY) !== data.user.id) return null
  return data.user.email ?? null
}

export async function resetPassword(newPassword: string): Promise<void> {
  if (!await recoveryEmail()) throw new Error('Your recovery session has expired. Request a new code or email link.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
  sessionStorage.removeItem(RECOVERY_USER_KEY)
  await supabase.auth.signOut({ scope: 'local' })
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
