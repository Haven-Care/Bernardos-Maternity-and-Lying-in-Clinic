import 'dotenv/config'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  get supabaseUrl() {
    return requireEnv('SUPABASE_URL')
  },
  get supabaseServiceRoleKey() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
}
