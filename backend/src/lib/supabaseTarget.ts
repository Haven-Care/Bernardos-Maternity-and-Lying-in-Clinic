/**
 * Where a script or test suite is about to write.
 *
 * Integration suites create staff, sign up patients and delete accounts; the
 * staff seed creates confirmed administrators with a password printed in this
 * repository. Both are for a laptop running `supabase start`. Deciding that
 * from the URL rather than NODE_ENV matters because NODE_ENV defaults to
 * development, so a hosted SUPABASE_URL left in a terminal would otherwise be
 * treated as a local one.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/** The documented local-only staff password. Never valid on a hosted project. */
export const DEV_STAFF_PASSWORD = 'HavenCare!2026'

export function isLocalSupabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/** `abcd1234` for `https://abcd1234.supabase.co`; null for anything else. */
export function hostedProjectRef(url: string): string | null {
  try {
    const { hostname } = new URL(url)
    return hostname.endsWith('.supabase.co') ? hostname.slice(0, -'.supabase.co'.length) : null
  } catch {
    return null
  }
}
