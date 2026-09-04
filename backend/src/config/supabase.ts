import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

let client: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  return client
}
