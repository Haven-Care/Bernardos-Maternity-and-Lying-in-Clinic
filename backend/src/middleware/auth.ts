import type { NextFunction, Request, Response } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { HttpError } from './errorHandler.js'
import type { StaffRole, StaffStatus } from '../contract/account.js'

/**
 * Authentication and authorization.
 *
 * The browser talks to GoTrue directly to log in and gets a JWT; it never
 * touches a table. Every data request then carries that JWT here, and this is
 * where it is checked.
 *
 * **This is the authorization boundary.** Express connects with the service_role
 * key, which bypasses row level security entirely, so RLS is not a second
 * opinion on any of these decisions — it only guarantees that a browser cannot
 * reach the database another way. If a handler is reachable without the right
 * guard in front of it, nothing downstream will catch that.
 */

export interface StaffContext {
  userId: string
  email: string
  role: StaffRole
  status: StaffStatus
  fullName: string
}

export interface PatientContext {
  userId: string
  email: string
  fullName: string
  contactNumber: string
}

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffContext
    patient?: PatientContext
  }
}

function bearerToken(req: Request): string {
  const header = req.get('authorization')

  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Not signed in.')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) throw new HttpError(401, 'Not signed in.')

  return token
}

/**
 * Verifies the JWT and returns the auth user.
 *
 * `getUser(token)` asks GoTrue to validate it rather than decoding it locally.
 * That is a network round trip per request, which at this clinic's scale is
 * irrelevant, and it means a revoked or expired session stops working
 * immediately instead of whenever the token would have expired on its own.
 */
async function verify(req: Request) {
  const token = bearerToken(req)
  const { data, error } = await getSupabaseClient().auth.getUser(token)

  if (error || !data.user) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.')
  }

  return data.user
}

/**
 * Attaches staff context when a valid staff token is present, and does nothing
 * when it is not.
 *
 * For endpoints a patient browses before signing up but whose *contents* differ
 * for staff — the services list is the case that matters: the public booking
 * form must only ever see active services, while Services & Pricing has to show
 * the deactivated ones in order to reactivate them.
 *
 * Scoping the response by who is asking keeps one route and one URL, rather
 * than a second endpoint that exists only to be public and would eventually
 * drift from the first. A bad token is treated as no token: this guard grants
 * nothing, so there is nothing to report an error about.
 */
export async function optionalStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.get('authorization')) {
    next()
    return
  }

  try {
    const user = await verify(req)

    const { data: profile } = await getSupabaseClient()
      .from('profiles')
      .select('id, full_name, email, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && profile.status === 'active') {
      req.staff = {
        userId: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        fullName: profile.full_name,
      }
    }
  } catch {
    // Anonymous, then.
  }

  next()
}

/** Any authenticated account, of either realm. Rarely what you want. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    await verify(req)
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * A staff member, active.
 *
 * The realm is decided by the `profiles` row, not by the token's app_metadata.
 * Both say the same thing today, but the row is the one the application
 * actually administers — deactivating someone writes `status`, and a token
 * issued before that must stop working.
 */
export async function requireStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const user = await verify(req)

    const { data: profile, error } = await getSupabaseClient()
      .from('profiles')
      .select('id, full_name, email, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    // Deliberately the same message as a wrong role: a patient poking at admin
    // routes learns only that they cannot have them.
    if (!profile) {
      throw new HttpError(403, 'You do not have access to this.')
    }

    if (profile.status !== 'active') {
      throw new HttpError(403, 'This account has been deactivated.')
    }

    req.staff = {
      userId: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      fullName: profile.full_name,
    }

    next()
  } catch (err) {
    next(err)
  }
}

/** Mount after requireStaff. */
export function requireRole(...roles: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.staff) {
      next(new HttpError(500, 'requireRole used without requireStaff'))
      return
    }

    if (!roles.includes(req.staff.role)) {
      next(new HttpError(403, 'You do not have access to this.'))
      return
    }

    next()
  }
}

/**
 * A patient with a confirmed email.
 *
 * Confirmation is enforced here as well as in GoTrue because an unconfirmed
 * address means the clinic would be holding a slot for someone it cannot reach.
 */
export async function requirePatient(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const user = await verify(req)

    if (!user.email_confirmed_at) {
      throw new HttpError(
        403,
        'Please confirm your email address before booking.',
      )
    }

    const { data: account, error } = await getSupabaseClient()
      .from('patient_accounts')
      .select('id, full_name, email, contact_number')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    if (!account) {
      throw new HttpError(403, 'You do not have access to this.')
    }

    req.patient = {
      userId: account.id,
      email: account.email,
      fullName: account.full_name,
      contactNumber: account.contact_number,
    }

    next()
  } catch (err) {
    next(err)
  }
}
