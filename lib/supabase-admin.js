import { createClient } from '@supabase/supabase-js'
import { validateEnv } from './env'

/**
 * Returns a Supabase client initialized with the service role key (or anon key).
 * Configured to support connection pooler port (PgBouncer/Supavisor) from environment variables if available.
 * Throws an explicit error if required environment variables are missing.
 */
export function getSupabaseAdmin() {
  validateEnv()
  let url = process.env.SUPABASE_POOLER_URL ||
            process.env.SUPABASE_POOLED_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_POOLER_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing in environment variables.')
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing, cannot construct admin client.')
  }

  const poolerPort = process.env.SUPABASE_POOLER_PORT ||
                     process.env.SUPABASE_POOLED_PORT ||
                     process.env.SUPABASE_DB_POOL_PORT

  if (poolerPort && !process.env.SUPABASE_POOLER_URL && !process.env.SUPABASE_POOLED_URL && !process.env.NEXT_PUBLIC_SUPABASE_POOLER_URL) {
    try {
      const parsedUrl = new URL(url)
      parsedUrl.port = poolerPort
      url = parsedUrl.toString().replace(/\/$/, '')
    } catch (e) {
      // Fallback to original url if parsing fails
    }
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}
