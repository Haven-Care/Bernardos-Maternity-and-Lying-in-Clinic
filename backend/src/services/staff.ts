import { personName, phoneNumber, emailAddress } from '../lib/inputValidation.js'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { HttpError } from '../middleware/errorHandler.js'
import { dbError, loggableDbError, readAll } from '../lib/db.js'
import { toStaffProfile } from '../mappers/account.js'
import type { StaffProfile } from '../contract/account.js'

/**
 * Staff provisioning.
 *
 * There is no self sign-up on the admin side — the flowchart says so and the
 * design has no screen for it. Accounts are created here, by an administrator
 * or by the seed script, which both call this one function so they cannot drift
 * apart.
 */

export const createStaffSchema = z.object({
  email: emailAddress().toLowerCase(),
  // The same 12 as every other account (frontend/src/lib/password.ts). GoTrue's
  // own floor is looser, and these accounts hold every medical record in the
  // clinic.
  password: z.string().min(12, 'Password must be at least 12 characters.').max(128, 'Password cannot exceed 128 characters.'),
  fullName: personName(),
  contactNumber: phoneNumber().default(''),
  role: z.enum(['administrator', 'staff']).default('staff'),
})

export type CreateStaffInput = z.infer<typeof createStaffSchema>

export async function createStaffAccount(
  input: CreateStaffInput,
): Promise<StaffProfile> {
  const db = getSupabaseClient()

  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    // Provisioned accounts are confirmed on creation. The alternative is
    // emailing a clinic staff member a confirmation link before they can do
    // their job, for an address an administrator just typed in deliberately.
    email_confirm: true,
    // The realm marker. Only settable with the service_role key — this is the
    // whole reason a patient cannot make themselves staff. The database trigger
    // reads it and creates the profile.
    app_metadata: { user_type: 'staff', staff_role: input.role },
    user_metadata: {
      full_name: input.fullName,
      contact_number: input.contactNumber,
    },
  })

  if (error) {
    // GoTrue reports a duplicate as a 422; anything else is ours.
    if (error.status === 422) {
      throw new HttpError(409, 'An account with that email already exists.')
    }
    console.error('Staff account creation failed', { status: error.status, code: error.code, message: error.message })
    throw new HttpError(502, 'Could not create the account. Please try again.')
  }

  let profile: StaffProfile | null
  try {
    profile = await findStaff(data.user.id)
  } catch (err) {
    await discardAuthUser(data.user.id)
    throw err
  }

  if (!profile) {
    // The trigger runs inside GoTrue's own transaction, so reaching here means
    // the realm sync did not fire — a schema problem, not a user error. Say so
    // rather than returning a half-made account.
    console.error('Staff account has no profile. Check on_auth_user_meta_changed.', { userId: data.user.id })
    await discardAuthUser(data.user.id)
    throw new HttpError(500, 'Account setup could not be completed. Contact the system administrator.')
  }

  return profile
}

/**
 * Undoes the GoTrue half of a staff account whose profile step failed.
 *
 * Left in place, the user could sign in to an account the portal cannot see,
 * and the administrator's retry would fail as a duplicate email. The account
 * is seconds old, so nothing in the clinic refers to it yet. A failure here is
 * logged, not thrown: the caller is already reporting the original one.
 */
async function discardAuthUser(id: string): Promise<void> {
  try {
    const { error } = await getSupabaseClient().auth.admin.deleteUser(id)
    if (error) console.error('Could not remove a half-created staff account', { userId: id, status: error.status, code: error.code })
  } catch (err) {
    console.error('Could not remove a half-created staff account', { userId: id, message: err instanceof Error ? err.message : String(err) })
  }
}

export async function findStaff(id: string): Promise<StaffProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw dbError(error)

  return data ? toStaffProfile(data) : null
}

export async function listStaff(): Promise<StaffProfile[]> {
  const rows = await readAll((from, to) =>
    getSupabaseClient()
      .from('profiles')
      .select('*')
      .order('employee_id')
      .order('id')
      .range(from, to),
  )

  return rows.map(toStaffProfile)
}

/** Active administrators: the people who can still provision anyone else. */
export async function countActiveAdministrators(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'administrator')
    .eq('status', 'active')

  if (error) throw dbError(error)

  return count ?? 0
}

/**
 * Deactivate or reactivate.
 *
 * Never a delete: `stock_movements.created_by` and
 * `patient_documents.uploaded_by` point at these rows, and removing one would
 * erase who recorded what. Deactivating stops the account working —
 * requireStaff rejects a non-active profile on the very next request.
 */
export async function setStaffStatus(
  id: string,
  status: 'active' | 'inactive',
): Promise<StaffProfile> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw dbError(error)
  if (!data) throw new HttpError(404, 'No such staff member.')

  return toStaffProfile(data)
}

/**
 * Recorded on sign-in so My Account's "Last login" is not fiction.
 *
 * Never throws. A stale "Last login" is a cosmetic problem; a sign-in that
 * fails because this bookkeeping write did is not.
 */
export async function touchLastLogin(id: string): Promise<void> {
  try {
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('Could not record last login', loggableDbError(error))
  } catch (err) {
    console.error('Could not record last login', err instanceof Error ? err.message : err)
  }
}
