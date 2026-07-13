import { createClient } from '@supabase/supabase-js'
import { validateEnv } from './env'

/**
 * Returns a Supabase client initialized with the service role key (or anon key).
 * Throws an explicit error if required environment variables are missing.
 */
export function getSupabaseAdmin() {
  validateEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing in environment variables.')
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing, cannot construct admin client.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}
