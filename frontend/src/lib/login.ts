import type { SessionIdentity } from '../types/account'

export function loginDestination(role: SessionIdentity['role'], from?: unknown): string {
  if (typeof from === 'string') {
    if (role !== 'patient' && /^\/admin(?:[/?#]|$)/.test(from)) return from
    if (role === 'patient' && (/^\/book(?:[?#]|$)/.test(from) || /^\/patient\/(home|bookings|account)(?:[/?#]|$)/.test(from))) return from
  }
  return role === 'patient' ? '/patient/home' : '/admin'
}

export function loginErrorMessage(error: unknown): string {
  const failure = error as { code?: string; status?: number; message?: string; name?: string } | null
  if (failure?.name === 'TimeoutError') return 'Sign-in took too long. Check your connection and try again.'
  if (failure?.code === 'email_not_confirmed') return 'Please confirm your email address before signing in.'
  if (failure?.code === 'invalid_credentials' || [400, 401, 403, 404].includes(failure?.status ?? 0)) {
    return 'Invalid account. Check your email and password.'
  }
  return 'Unable to sign in right now. Check your connection and try again.'
}
