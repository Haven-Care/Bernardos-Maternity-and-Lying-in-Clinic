import type {
  PatientAccount,
  PatientProfileInput,
  PatientSignupInput,
} from '../types/patientAccount'
import { apiFetch } from './client'
import { supabase } from '../lib/supabase'

/**
 * Patient accounts.
 *
 * Patients are the only people who can register themselves, and only into the
 * patient surface — there is no self sign-up on the staff side. Which realm an
 * account belongs to is decided by `app_metadata`, which only the server can
 * write, so nothing typed into this form can make someone staff.
 */

/**
 * Register.
 *
 * Email confirmation is required before booking. Without it anyone could book
 * against an address they do not own, and the clinic would hold a slot for
 * someone it cannot reach. `signUp` therefore returns no usable session — the
 * patient confirms first, then signs in.
 *
 * In local development the confirmation mail lands in the catcher on :54324
 * rather than a real inbox.
 */
export async function signUp(input: PatientSignupInput): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      // Goes to user_metadata, which the browser controls — fine for a name
      // and a phone number, and deliberately not where the realm is read from.
      data: {
        full_name: input.fullName.trim(),
        contact_number: input.contactNumber.trim(),
      },
    },
  })

  if (error) throw new Error(error.message)
}

export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  // GoTrue says "Email not confirmed" distinctly from bad credentials, which
  // is worth passing through — it is the one case the patient can act on.
  if (error) throw new Error(error.message)
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getAccount(): Promise<PatientAccount> {
  return apiFetch<PatientAccount>('/me/account')
}

/**
 * The email is not editable here.
 *
 * Changing it changes the address that signs in and receives password resets,
 * which needs a confirmation round trip rather than a text field on a profile
 * page.
 */
export async function updateAccount(
  input: Partial<PatientProfileInput & { emailNotifications: boolean }>,
): Promise<PatientAccount> {
  return apiFetch<PatientAccount>('/me/account', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
  )
  if (error) throw new Error(error.message)
}

/**
 * Change password from the patient Account page.
 *
 * The same round trip as the staff one — re-authenticate with the current
 * password, then `updateUser` — because both realms are GoTrue users and none
 * of it goes through Express. Re-exported rather than copied, so a fix to one
 * is a fix to both.
 */
export { changePassword } from './account'
