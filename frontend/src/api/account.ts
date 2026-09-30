import type {
  ChangePasswordInput,
  LoginInput,
  NotificationPrefs,
  ProfileInput,
  StaffProfile,
} from '../types/account'
import { apiFetch } from './client'
import { supabase } from '../lib/supabase'

/**
 * Sign in.
 *
 * Two steps, deliberately. GoTrue proves the credentials and issues a token;
 * Express then says who that token actually belongs to. The JWT only asserts
 * "some authenticated user" — the role, status and employee number that the
 * portal renders all come from the `profiles` row.
 *
 * **Email only.** The prototype's field reads "username or email", but GoTrue
 * authenticates on email, and resolving a username would need an
 * unauthenticated lookup endpoint — which is an oracle telling anyone who asks
 * whether a given username exists. With a handful of provisioned accounts a
 * username buys nothing, so the label was changed to match. See the plan's open
 * items if the clinic wants it back.
 */
export async function login(input: LoginInput): Promise<StaffProfile> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.identifier.trim().toLowerCase(),
    password: input.password,
  })

  // GoTrue says "Invalid login credentials" without distinguishing a wrong
  // password from an unknown address, which is the correct behaviour — do not
  // improve on it.
  if (error) throw new Error(error.message)

  // GoTrue has already stored a session by now. If Express will not accept it
  // — a patient on the staff login, a deactivated account, no profile row —
  // that session has to go too, or every guard after this reads it as signed in.
  try {
    return await apiFetch<StaffProfile>('/account/me')
  } catch (e) {
    await supabase.auth.signOut()
    throw e
  }
}

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
 * Change password from My Account.
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

/**
 * Sends the six-digit code.
 *
 * This only works because the recovery email template emits `{{ .Token }}`
 * instead of the default `{{ .ConfirmationURL }}` — see supabase/config.toml.
 * With the stock template the mail contains a link, `verifyResetCode` below has
 * nothing to check, and the Verify Code screen is unreachable.
 *
 * Resolves even for an address with no account. Reporting "no such user" here
 * would let anyone enumerate the clinic's staff addresses.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
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
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  })

  if (error) throw new Error('That code is incorrect or has expired.')
}

export async function resetPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
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
