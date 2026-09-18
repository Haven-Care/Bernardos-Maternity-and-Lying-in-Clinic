import type {
  ChangePasswordInput,
  LoginInput,
  NotificationPrefs,
  ProfileInput,
  StaffProfile,
} from '../types/account'
import { notificationPrefs, profile } from '../mocks/account'
import { mockDelay, mockReject } from '../mocks/util'
// import { apiFetch } from './client'
// import { supabase } from '../lib/supabase'

/**
 * Sign in.
 *
 * The form's field reads "username or email", but Supabase Auth is email-only.
 * The backend phase must either resolve a username to its email before calling
 * `signInWithPassword`, or the field becomes email-only. Decide before wiring
 * this — it changes the schema (`profiles.username`).
 */
export async function login(input: LoginInput): Promise<StaffProfile> {
  // BACKEND: const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  // BACKEND: if (error) throw error; return apiFetch<StaffProfile>('/account/me')
  if (!input.identifier || !input.password) {
    return mockReject('Enter your username and password')
  }
  return mockDelay(profile)
}

export async function logout(): Promise<void> {
  // BACKEND: await supabase.auth.signOut()
  return mockDelay(undefined)
}

export async function getProfile(): Promise<StaffProfile> {
  // BACKEND: return apiFetch<StaffProfile>('/account/me')
  return mockDelay(profile)
}

export async function updateProfile(
  input: ProfileInput,
): Promise<StaffProfile> {
  // BACKEND: return apiFetch<StaffProfile>('/account/me', { method: 'PATCH', body: JSON.stringify(input) })
  Object.assign(profile, input)
  return mockDelay(profile)
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  // BACKEND: const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  // BACKEND: if (error) throw error
  if (input.newPassword.length < 8) {
    return mockReject('Password must be at least 8 characters')
  }
  return mockDelay(undefined)
}

// --- Password reset: email → 6-digit code → new password -------------------

export async function requestPasswordReset(email: string): Promise<void> {
  // BACKEND: const { error } = await supabase.auth.resetPasswordForEmail(email)
  // BACKEND: if (error) throw error
  if (!email.includes('@')) return mockReject('Enter a valid email address')
  return mockDelay(undefined)
}

export async function verifyResetCode(
  email: string,
  code: string,
): Promise<void> {
  // BACKEND: const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
  // BACKEND: if (error) throw error
  if (!email) return mockReject('Start again from the reset form')
  if (code.length !== 6) return mockReject('Enter the 6-digit code')
  return mockDelay(undefined)
}

export async function resetPassword(newPassword: string): Promise<void> {
  // BACKEND: const { error } = await supabase.auth.updateUser({ password: newPassword })
  // BACKEND: if (error) throw error
  if (newPassword.length < 8) {
    return mockReject('Password must be at least 8 characters')
  }
  return mockDelay(undefined)
}

// --- Preferences -----------------------------------------------------------

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  // BACKEND: return apiFetch<NotificationPrefs>('/account/notifications')
  return mockDelay(notificationPrefs)
}

export async function updateNotificationPrefs(
  input: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  // BACKEND: return apiFetch<NotificationPrefs>('/account/notifications', { method: 'PATCH', body: JSON.stringify(input) })
  Object.assign(notificationPrefs, input)
  return mockDelay(notificationPrefs)
}
