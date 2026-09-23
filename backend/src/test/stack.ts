import { env } from '../config/env.js'

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
 * has not started Docker sees "skipped", not a wall of red — and so CI, which
 * has no Supabase service yet, stays honest instead of appearing to test this.
 */

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'HavenCare!2026'

export const ADMIN_EMAIL = 'hannahp@havencare.ph'
export const STAFF_EMAIL = 'staff@havencare.ph'

export async function stackIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
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

/** Registers a patient and returns their JWT. Email confirmation is on. */
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
      data: { full_name: fullName, ...extra },
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

/** A unique address per run, so repeated runs do not collide on sign-up. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}
