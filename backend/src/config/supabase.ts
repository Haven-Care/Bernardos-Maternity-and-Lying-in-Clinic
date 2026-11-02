import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'
import type { Database } from '../db/types.js'

/**
 * The service_role client.
 *
 * This key bypasses row level security and every authorization check in the
 * database, so it is the only thing in the system that can see all the data —
 * and it must never leave the server. Authorization happens in
 * `middleware/auth.ts`; this client trusts that it already has.
 *
 * Typed with the generated schema, so a renamed column fails the build instead
 * of returning undefined at runtime. Regenerate with `npm run db:types` after
 * any migration.
 */
export type Db = SupabaseClient<Database>

let client: Db | undefined

/**
 * How long any one call to Supabase may take.
 *
 * Without a bound, a hung connection holds the serverless function open until
 * Vercel kills it, and the browser waits all that time for an error it could
 * have had at once. Ten seconds is far beyond any query this API makes.
 */
export const SUPABASE_TIMEOUT_MS = 10_000

export function fetchWithTimeout(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
}

export function getSupabaseClient(): Db {
  client ??= createClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: {
        // No sessions on the server: every request carries its own JWT and is
        // verified explicitly. Persisting one here would mean the API had an
        // ambient identity of its own.
        persistSession: false,
        autoRefreshToken: false,
      },
      global: { fetch: fetchWithTimeout },
    },
  )

  return client
}
