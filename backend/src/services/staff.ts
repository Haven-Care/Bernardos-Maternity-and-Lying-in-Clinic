import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { HttpError } from '../middleware/errorHandler.js'
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
  email: z.string().trim().toLowerCase().email(),
  // GoTrue's own floor is 6. Eight is not meaningful security on its own, but
  // these accounts hold every medical record in the clinic.
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().trim().min(1, 'Full name is required.'),
  contactNumber: z.string().trim().default(''),
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
    throw new HttpError(502, `Could not create the account: ${error.message}`)
  }

  const profile = await findStaff(data.user.id)

  if (!profile) {
    // The trigger runs inside GoTrue's own transaction, so reaching here means
    // the realm sync did not fire — a schema problem, not a user error. Say so
    // rather than returning a half-made account.
    throw new HttpError(
      500,
      'The account was created but no staff profile followed it. Check the ' +
        'on_auth_user_meta_changed trigger.',
    )
  }

  return profile
}

export async function findStaff(id: string): Promise<StaffProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message)

  return data ? toStaffProfile(data) : null
}

export async function listStaff(): Promise<StaffProfile[]> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .order('employee_id')

  if (error) throw new HttpError(500, error.message)

  return data.map(toStaffProfile)
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

  if (error) throw new HttpError(500, error.message)
  if (!data) throw new HttpError(404, 'No such staff member.')

  return toStaffProfile(data)
}

/** Recorded on sign-in so My Account's "Last login" is not fiction. */
export async function touchLastLogin(id: string): Promise<void> {
  await getSupabaseClient()
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', id)
}
