import { createClient } from '@supabase/supabase-js'

/**
 * The browser's connection to Supabase Auth — and to nothing else.
 *
 * This client is used for exactly one job: proving who you are. Signing in,
 * signing out, resetting a password, refreshing the session. **It never reads
 * or writes a table.** All data goes through Express, which is where the
 * business rules live; the auto-generated PostgREST API is not a second door
 * into this system.
 *
 * That is enforced rather than agreed: every table has row level security
 * enabled with no policies, so the anon key below grants nothing at all. It is
 * a publishable key — it identifies the project and is meant to ship in a
 * client bundle. The service_role key, which does bypass everything, lives only
 * in the backend's environment.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Failing loudly at startup beats a login form that silently never works.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example ' +
      'to .env and fill them in from `npm run db:status` at the repo root.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // OAuth and email confirmation keep using the portal client. A predicate
    // must check credentials as well as the path: it replaces Supabase's own
    // implicit-callback detection, including on ordinary page loads.
    detectSessionInUrl: (callbackUrl, params) => callbackUrl.pathname !== '/auth/recovery' && Boolean(params.access_token || params.error || params.error_description || params.error_code),
  },
})

// A verified reset code or email link must not replace an existing login or sign a visitor
// into the portal. Keep its temporary session separate and in memory only.
export const recoverySupabase = createClient(url, anonKey, {
  auth: {
    storageKey: 'havencare:password-recovery',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: (callbackUrl, params) => callbackUrl.pathname === '/auth/recovery' && Boolean(params.access_token || params.error || params.error_description || params.error_code),
  },
})

/** The current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// The marker identifies a server-verified recovery session, never a password or token.
export const RECOVERY_USER_KEY = 'havencare:recovery-user'
export const RECOVERY_RETURN_KEY = 'havencare:recovery-return'
recoverySupabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') sessionStorage.removeItem(RECOVERY_USER_KEY)
})
