import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { toNotificationPrefs, toStaffProfile } from '../mappers/account.js'
import { findStaff, touchLastLogin } from '../services/staff.js'

function requireStaffContext(req: Request) {
  if (!req.staff) throw new HttpError(500, 'Handler used without requireStaff')
  return req.staff
}

/**
 * GET /api/account/me
 *
 * What the login flow calls once GoTrue has issued a token: the browser
 * authenticates against GoTrue, then asks Express who that actually is. The
 * JWT says "some authenticated user"; this says "Hannah Puerta, administrator,
 * active", which is what the portal shell renders and what authorization is
 * decided on.
 */
export async function getMe(req: Request, res: Response) {
  const staff = requireStaffContext(req)

  const profile = await findStaff(staff.userId)
  if (!profile) throw new HttpError(404, 'No staff profile for this account.')

  // Fire-and-forget: a failed bookkeeping write must not fail the sign-in that
  // triggered it. "Last login" showing a stale time is a cosmetic problem;
  // being unable to log in is not.
  void touchLastLogin(staff.userId)

  res.json(profile)
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  contactNumber: z.string().trim().default(''),
})

/**
 * PATCH /api/account/me
 *
 * Changing the email means changing it in GoTrue, not just in `profiles` —
 * otherwise the address shown on My Account and the address that signs in would
 * drift apart, and the reset email would go to the old one. Doing it through
 * the admin API applies it without a confirmation round trip, which is right
 * for a staff account an administrator already vouched for.
 *
 * The `on_auth_user_email_changed` trigger mirrors it back into `profiles`, so
 * that column is never written here.
 */
export async function updateMe(req: Request, res: Response) {
  const staff = requireStaffContext(req)
  const input = parseBody(profileSchema, req.body)
  const db = getSupabaseClient()

  if (input.email !== staff.email) {
    const { error } = await db.auth.admin.updateUserById(staff.userId, {
      email: input.email,
    })

    if (error) {
      throw new HttpError(
        error.status === 422 ? 409 : 502,
        error.status === 422
          ? 'Another account already uses that email address.'
          : `Could not update the email address: ${error.message}`,
      )
    }
  }

  const row = unwrap(
    await db
      .from('profiles')
      .update({
        full_name: input.fullName,
        contact_number: input.contactNumber,
      })
      .eq('id', staff.userId)
      .select('*')
      .maybeSingle(),
    'No staff profile for this account.',
  )

  res.json(toStaffProfile(row))
}

const prefsSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    newBookingAlerts: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

export async function getNotificationPrefs(req: Request, res: Response) {
  const staff = requireStaffContext(req)

  const row = unwrap(
    await getSupabaseClient()
      .from('notification_prefs')
      .select('*')
      .eq('profile_id', staff.userId)
      .maybeSingle(),
    'No notification preferences for this account.',
  )

  res.json(toNotificationPrefs(row))
}

export async function updateNotificationPrefs(req: Request, res: Response) {
  const staff = requireStaffContext(req)
  const input = parseBody(prefsSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('notification_prefs')
      .update({
        ...(input.emailNotifications !== undefined && {
          email_notifications: input.emailNotifications,
        }),
        ...(input.newBookingAlerts !== undefined && {
          new_booking_alerts: input.newBookingAlerts,
        }),
      })
      .eq('profile_id', staff.userId)
      .select('*')
      .maybeSingle(),
    'No notification preferences for this account.',
  )

  res.json(toNotificationPrefs(row))
}
