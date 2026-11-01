import 'dotenv/config'
import { z } from 'zod'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const LOCAL_FRONTEND = 'http://localhost:6100'

const startupSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(6101),
  NODE_ENV: z.string().min(1).default('development'),
  CORS_ORIGIN: z.string().optional(),
})

/**
 * CORS_ORIGIN is a comma-separated list, so one deployment can serve the
 * clinic domain and its vercel.app address during a move. Entries are
 * normalised to bare origins; `*` is refused outright, because the API serves
 * medical records and a wildcard would hand any site a CORS grant to it.
 */
export function parseCorsOrigins(raw: string | undefined, nodeEnv: string): string[] {
  const entries = (raw ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)

  if (entries.length === 0) {
    if (nodeEnv === 'production') {
      throw new Error('CORS_ORIGIN is required in production: list the frontend origin(s).')
    }
    return [LOCAL_FRONTEND]
  }

  return entries.map((entry) => {
    if (entry === '*') throw new Error('CORS_ORIGIN must list origins; "*" is not allowed.')
    let url: URL
    try {
      url = new URL(entry)
    } catch {
      throw new Error(`CORS_ORIGIN entry "${entry}" is not a URL.`)
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`CORS_ORIGIN entry "${entry}" must be an origin (scheme://host[:port]), not a page.`)
    }
    return url.origin
  })
}

// Validated once, when the module loads, so a misconfigured deployment fails
// on its first request instead of answering /health as if it were fine. The
// Supabase values stay lazy below: tests and the liveness route run without
// them, and a script reports the missing one by name when it first needs it.
const startup = startupSchema.parse(process.env)

export const env = {
  port: startup.PORT,
  nodeEnv: startup.NODE_ENV,
  corsOrigins: parseCorsOrigins(startup.CORS_ORIGIN, startup.NODE_ENV),
  get supabaseUrl() {
    return requireEnv('SUPABASE_URL')
  },
  get supabaseServiceRoleKey() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
}
