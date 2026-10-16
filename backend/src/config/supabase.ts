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
    },
  )

  return client
}
