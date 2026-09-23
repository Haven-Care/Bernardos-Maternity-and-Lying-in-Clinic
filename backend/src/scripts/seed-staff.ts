/**
 * Creates the clinic's staff accounts.
 *
 * Separate from supabase/seed.sql because these need rows in `auth.users`, and
 * only GoTrue can make those — SQL cannot hash a password the auth service will
 * accept. It goes through the same createStaffAccount() the /admin/system screen
 * uses, so there is one provisioning path rather than two that drift.
 *
 *   npm run seed:staff            # from backend/
 *   SEED_STAFF_PASSWORD=... npm run seed:staff
 *
 * Idempotent: an account that already exists is reported and skipped.
 */

import { createStaffAccount } from '../services/staff.js'
import { HttpError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'

// A known-weak local password. The guard below is what stops it reaching
// anything real — this is for a laptop running `supabase start`, and it is
// printed to the terminal on every run so nobody mistakes it for a secret.
const DEV_PASSWORD = 'HavenCare!2026'

const STAFF = [
  {
    // The signed-in user shown throughout the prototype.
    email: 'hannahp@havencare.ph',
    fullName: 'Hannah Puerta',
    contactNumber: '0917 456 7890',
    role: 'administrator' as const,
  },
  {
    // A second, non-administrator account, so role checks are exercisable
    // without editing the database by hand.
    email: 'staff@havencare.ph',
    fullName: 'Clinic Staff',
    contactNumber: '0917 000 0000',
    role: 'staff' as const,
  },
]

async function main() {
  const password = process.env.SEED_STAFF_PASSWORD ?? DEV_PASSWORD

  if (env.nodeEnv === 'production' && !process.env.SEED_STAFF_PASSWORD) {
    throw new Error(
      'Refusing to seed production staff with the built-in development ' +
        'password. Set SEED_STAFF_PASSWORD.',
    )
  }

  if (!process.env.SEED_STAFF_PASSWORD) {
    console.log(`Using the development password: ${DEV_PASSWORD}\n`)
  }

  for (const member of STAFF) {
    try {
      const profile = await createStaffAccount({ ...member, password })
      console.log(
        `created  ${profile.employeeId}  ${profile.fullName} <${profile.email}> (${profile.role})`,
      )
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        console.log(`exists   ${member.email} — skipped`)
        continue
      }
      throw err
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
