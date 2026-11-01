import { env } from '../config/env.js'
import { getSupabaseClient } from '../config/supabase.js'
import { PRIVACY_NOTICE_VERSION } from '../contract/privacy.js'
import { DEV_STAFF_PASSWORD, isLocalSupabaseUrl } from '../lib/supabaseTarget.js'

/**
 * Helpers for tests that need the real local stack.
 *
 * These are contract tests, not unit tests: they assert that the API returns
 * what `frontend/src/types/` says it does, which means talking to an actual
 * database. Mocking Supabase here would only assert that the mock matches the
 * mock.
 *
 * Run `npm run db:start && npm run db:reset && npm run seed:staff` first. When
 * the stack is not up the suites skip rather than fail, so a contributor who
 * has not started Docker sees "skipped", not a wall of red. Set REQUIRE_DB=1
 * where a skip would be a false pass, as in a CI job that starts Supabase:
 * the suites then fail instead.
 *
 * Only a local stack counts as up. These suites create staff, sign up patients
 * and delete accounts, so a hosted SUPABASE_URL left in the terminal must never
 * be mistaken for a disposable database.
 */

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? DEV_STAFF_PASSWORD

export const ADMIN_EMAIL = 'hannahp@havencare.ph'
export const STAFF_EMAIL = 'staff@havencare.ph'

export async function stackIsUp(): Promise<boolean> {
  const required = process.env.REQUIRE_DB === '1'
  const url = process.env.SUPABASE_URL ?? ''

  if (!isLocalSupabaseUrl(url)) {
    if (required) {
      throw new Error(
        `REQUIRE_DB=1 but SUPABASE_URL (${url || 'unset'}) is not a local Supabase stack. ` +
          'Integration suites only run against `supabase start`.',
      )
    }
    return false
  }

  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) return true
  } catch {
    // Unreachable; handled below.
  }

  if (required) {
    throw new Error(`REQUIRE_DB=1 but the local Supabase stack at ${url} is not responding.`)
  }
  return false
}

/** Signs in through GoTrue exactly as the browser does, and returns the JWT. */
export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${env.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  )

  const body = (await res.json()) as { access_token?: string; msg?: string }

  if (!res.ok || !body.access_token) {
    throw new Error(`Sign-in failed for ${email}: ${body.msg ?? res.status}`)
  }

  return body.access_token
}

/**
 * Registers a patient and returns their JWT. Email confirmation is on.
 *
 * Ticks the privacy-notice box, as the sign-up form requires, so the account
 * can book. Pass `{ privacy_notice_version: null }` in `extra` to sign up
 * without it.
 */
export async function signUpPatient(
  email: string,
  password: string,
  fullName: string,
  /**
   * Extra sign-up metadata. Only tests pass this, to prove that what the
   * browser puts here cannot change the realm — it lands in user_metadata,
   * and the realm is read from app_metadata.
   */
  extra: Record<string, unknown> = {},
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      data: { full_name: fullName, privacy_notice_version: PRIVACY_NOTICE_VERSION, ...extra },
    }),
  })

  const body = (await res.json()) as {
    id?: string
    access_token?: string
    msg?: string
  }

  if (!res.ok || !body.id) {
    throw new Error(`Sign-up failed for ${email}: ${body.msg ?? res.status}`)
  }

  // With confirmations enabled, signup issues no session — confirm through the
  // admin API (standing in for the user clicking the link) and then sign in.
  await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${body.id}`, {
    method: 'PUT',
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_confirm: true }),
  })

  return { token: await signIn(email, password), userId: body.id }
}

/**
 * Lifts the per-account booking cap and the booking window for a suite.
 *
 * The contract suites book one account into many separate weeks, well past
 * the clinic's defaults of 3 upcoming bookings and 90 days ahead. The limits
 * themselves are asserted in supabase/tests/security_hardening.sql. Returns the
 * function that puts the clinic's values back.
 */
export async function relaxBookingLimits(): Promise<() => Promise<void>> {
  const db = getSupabaseClient()
  const { data: before, error } = await db
    .from('clinic_settings')
    .select('max_active_bookings_per_account, max_booking_days_ahead')
    .eq('id', 1)
    .single()
  if (error) throw new Error(`Could not read booking limits: ${error.message}`)

  await db.from('clinic_settings')
    .update({ max_active_bookings_per_account: 1000, max_booking_days_ahead: 3650 })
    .eq('id', 1)

  return async () => {
    await db.from('clinic_settings').update(before).eq('id', 1)
  }
}

/**
 * Removes a test account's bookings and patient record.
 *
 * Status history and clinical records refuse to cascade (migration 26), so
 * they go first, explicitly. This is the only place anything deletes them.
 */
export async function removeTestBookings(filter: { accountId: string } | { bookingId: string }) {
  const db = getSupabaseClient()
  const bookings = 'bookingId' in filter
    ? [filter.bookingId]
    : ((await db.from('appointments').select('id').eq('account_id', filter.accountId)).data ?? []).map((row) => row.id)

  if (bookings.length > 0) {
    await db.from('appointment_status_events').delete().in('booking_id', bookings)
    await db.from('appointments').delete().in('id', bookings)
  }

  if ('accountId' in filter) {
    const { data: patients } = await db.from('patients').select('id').eq('account_id', filter.accountId)
    const ids = (patients ?? []).map((row) => row.id)
    if (ids.length > 0) {
      await db.from('clinical_records').delete().in('patient_id', ids)
      await db.from('patient_documents').delete().in('patient_id', ids)
      await db.from('patients').delete().in('id', ids)
    }
  }
}

/** A unique address per run, so repeated runs do not collide on sign-up. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}
