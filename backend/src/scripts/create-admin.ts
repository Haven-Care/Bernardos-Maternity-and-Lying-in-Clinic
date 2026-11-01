/**
 * Creates one real administrator: the first account on a new project.
 *
 * Every later staff account is made from /admin/system by an administrator;
 * this exists because that screen needs an administrator to exist first. It
 * goes through the same createStaffAccount() as the screen and the seed.
 *
 *   ADMIN_EMAIL=... ADMIN_FULL_NAME=... ADMIN_PASSWORD=... \
 *     npm run create:admin -- --project-ref <ref>
 *
 * The password comes from the environment, not the command line, so it does
 * not land in shell history. The project ref must be typed out and match
 * SUPABASE_URL (`local` for `supabase start`), so a terminal still pointed at
 * the wrong project fails before anything is written.
 */

import { createStaffAccount, createStaffSchema } from '../services/staff.js'
import { HttpError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'
import { DEV_STAFF_PASSWORD, hostedProjectRef, isLocalSupabaseUrl } from '../lib/supabaseTarget.js'

function projectRefArgument(): string | undefined {
  const args = process.argv.slice(2)
  const inline = args.find((arg) => arg.startsWith('--project-ref='))
  if (inline) return inline.slice('--project-ref='.length)
  const index = args.indexOf('--project-ref')
  return index === -1 ? undefined : args[index + 1]
}

async function main() {
  const requested = projectRefArgument()
  const actual = isLocalSupabaseUrl(env.supabaseUrl) ? 'local' : hostedProjectRef(env.supabaseUrl)

  if (!requested) {
    throw new Error('Pass the target explicitly: `npm run create:admin -- --project-ref <ref>` (or `local`).')
  }
  if (requested !== actual) {
    throw new Error(`--project-ref ${requested} does not match SUPABASE_URL (${new URL(env.supabaseUrl).hostname}).`)
  }

  const password = process.env.ADMIN_PASSWORD ?? ''
  if (password.length < 12 || password === DEV_STAFF_PASSWORD) {
    throw new Error('ADMIN_PASSWORD must be a private password of at least 12 characters.')
  }

  const parsed = createStaffSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password,
    fullName: process.env.ADMIN_FULL_NAME,
    contactNumber: process.env.ADMIN_CONTACT_NUMBER,
    role: 'administrator',
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'))
  }

  try {
    const profile = await createStaffAccount(parsed.data)
    console.log(`created  ${profile.employeeId}  ${profile.fullName} <${profile.email}> (administrator) on ${actual}`)
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      throw new Error(`${parsed.data.email} already has an account on ${actual}. Nothing was changed.`, { cause: err })
    }
    throw err
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
