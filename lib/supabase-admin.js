import { createClient } from '@supabase/supabase-js'
import { validateEnv } from './env.js'
import { logger } from './logger.js'

/**
 * Returns a Supabase client initialized with the service role key (or anon key).
 * Configured to support connection pooler port (PgBouncer/Supavisor) from environment variables if available.
 * Throws an explicit error if required environment variables are missing.
 */

// Chainable mock database query builder for integration tests
const makeMockQuery = (data = [], error = null) => {
  const chain = {};
  chain.then = (resolve) => Promise.resolve({ data, error }).then(resolve);
  chain.catch = (reject) => Promise.resolve({ data, error }).catch(reject);
  chain.finally = (callback) => Promise.resolve({ data, error }).finally(callback);

  const handler = {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return chain[prop];
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => {
          const singleData = Array.isArray(data) ? (data[0] || null) : data;
          return makeMockQuery(singleData, error);
        };
      }
      return () => new Proxy({}, handler);
    }
  };

  return new Proxy({}, handler);
};

let supabaseAdminClient = null;

export function getSupabaseAdmin() {
  if (process.env.NEXT_PUBLIC_MOCK_DB === 'true') {
    return {
      from: (table) => {
        if (table === 'users') {
          return makeMockQuery([{ id: 'mock_user_12345' }], null);
        }
        if (table === 'cycles') {
          return makeMockQuery([
            { id: '407d5dfc-658b-4a5f-9f7a-8f1ea8e05c2a', start_date: '2026-07-01', end_date: '2026-07-05', cycle_length: 28 }
          ], null);
        }
        if (table === 'daily_logs') {
          return makeMockQuery([
            { date: '2026-07-01', symptoms: ['cramps', 'headache'] }
          ], null);
        }
        if (table === 'weight_entries') {
          return makeMockQuery([
            { recorded_date: '2026-07-01', weight_kg: 60.5, height_cm: 165 }
          ], null);
        }
        if (table === 'user_profiles') {
          return makeMockQuery([
            { user_id: 'mock_user_12345', age: 25, weight_kg: 60.5, height_cm: 165, known_conditions: [], cycle_goal: 'track' }
          ], null);
        }
        if (table === 'oauth_providers') {
          return makeMockQuery([
            { id: 'google', name: 'Google', client_id: 'mock_google_id', client_secret: 'mock_secret', is_enabled: true, scopes: ['email', 'profile'], updated_at: new Date().toISOString() },
            { id: 'github', name: 'GitHub', client_id: 'mock_github_id', client_secret: 'mock_secret', is_enabled: false, scopes: ['user:email'], updated_at: new Date().toISOString() },
            { id: 'apple', name: 'Apple', client_id: '', client_secret: '', is_enabled: false, scopes: ['name', 'email'], updated_at: new Date().toISOString() },
            { id: 'facebook', name: 'Facebook', client_id: '', client_secret: '', is_enabled: false, scopes: ['email'], updated_at: new Date().toISOString() }
          ], null);
        }
        if (table === 'auth_logs') {
          return makeMockQuery([
            { id: 'mock-log-1', provider: 'google', event: 'CALLBACK_SUCCESS', status: 'success', message: 'User logged in via Google OAuth', user_id: 'mock_user_12345', created_at: new Date().toISOString() },
            { id: 'mock-log-2', provider: 'github', event: 'PROVIDER_ENABLED', status: 'info', message: 'GitHub OAuth provider activated', user_id: 'mock_admin_123', created_at: new Date().toISOString() }
          ], null);
        }
        if (table === 'forum_posts' || table === 'forum_comments' || table === 'forum_categories') {
          return makeMockQuery([{ id: 'mock-uuid-12345', category_id: 'mock-cat-12345', name: 'General', title: 'Test Title', content: 'Test Content' }], null);
        }
        return makeMockQuery([], null);
      },
      // The mock client has to answer `rpc` too. Without it every
      // `supabase.rpc(...)` call in mock mode threw a TypeError that the
      // callers swallowed, which meant mock runs exercised the rate limiter's
      // degraded path rather than its real one.
      rpc: (name) => {
        if (name === 'handle_vote') {
          return Promise.resolve({ data: { action: 'added', current_vote: 1 }, error: null });
        }
        if (name === 'enforce_rate_limit') {
          return Promise.resolve({
            data: {
              allowed: true,
              count: 1,
              reset_at: new Date(Date.now() + 60000).toISOString()
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };
  }

  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

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

  supabaseAdminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  })

  return supabaseAdminClient;
}

/**
 * Classifies a Supabase/Postgres error into a category, so callers and logs
 * can distinguish "the network is having a bad day, retry" from "the
 * credentials are wrong" from "the schema doesn't match what we expect" —
 * three very different problems that all used to surface as an identical
 * unhandled exception and a generic 500.
 *
 * @param {any} error
 * @returns {'timeout'|'auth'|'schema'|'unknown'}
 */
function classifySupabaseError(error) {
  if (!error) return 'unknown'
  const message = String(error?.message || error).toLowerCase()
  const code = error?.code

  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('network')
  ) {
    return 'timeout'
  }

  if (
    code === '28P01' || // invalid_password
    code === '28000' || // invalid_authorization_specification
    message.includes('jwt') ||
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('permission denied')
  ) {
    return 'auth'
  }

  if (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('column') && message.includes('does not exist')
  ) {
    return 'schema'
  }

  return 'unknown'
}

/**
 * Whether a classified error is worth retrying. Timeouts are transient and
 * often succeed on a second attempt; auth and schema problems will not
 * change no matter how many times they're retried, so retrying them only
 * delays a response the caller could have had immediately.
 *
 * @param {'timeout'|'auth'|'schema'|'unknown'} kind
 * @returns {boolean}
 */
function isRetryable(kind) {
  return kind === 'timeout' || kind === 'unknown'
}

/**
 * Runs a Supabase query with a timeout and a small number of retries for
 * transient failures, logging a structured, classified error via `logger`
 * either way.
 *
 * This does not change what a successful call returns — it wraps the same
 * `{ data, error }` shape Supabase always returns, so existing call sites
 * (`const { data, error } = await supabaseAdmin.from(...)...`) keep working
 * unchanged. It's meant for call sites that want the added timeout/retry
 * protection; using it is opt-in, not required.
 *
 * @param {() => PromiseLike<{ data: any, error: any }>} queryFn a function
 *   that returns the Supabase query builder call, e.g.
 *   `() => supabaseAdmin.from('cycles').select('*')`
 * @param {{ timeoutMs?: number, retries?: number, label?: string }} [options]
 * @returns {Promise<{ data: any, error: any, friendlyError: string|null }>}
 */
export async function runSupabaseQuery(queryFn, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000
  const retries = options.retries ?? 2
  const label = options.label || 'supabase_query'

  let lastError = null

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Supabase query timed out after ${timeoutMs}ms`)), timeoutMs)
      })

      const result = await Promise.race([queryFn(), timeoutPromise])

      if (result?.error) {
        const kind = classifySupabaseError(result.error)
        logger.error(`[${label}] Supabase query returned an error`, {
          kind,
          attempt,
          message: result.error.message,
          code: result.error.code,
        })

        if (isRetryable(kind) && attempt <= retries) {
          lastError = result.error
          await new Promise((r) => setTimeout(r, 200 * attempt))
          continue
        }

        return {
          data: result.data ?? null,
          error: result.error,
          friendlyError: toFriendlyMessage(kind),
        }
      }

      return { data: result.data, error: null, friendlyError: null }
    } catch (err) {
      const kind = classifySupabaseError(err)
      lastError = err
      logger.error(`[${label}] Supabase query threw`, {
        kind,
        attempt,
        message: err?.message,
      })

      if (isRetryable(kind) && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 200 * attempt))
        continue
      }

      return { data: null, error: err, friendlyError: toFriendlyMessage(kind) }
    }
  }

  return { data: null, error: lastError, friendlyError: toFriendlyMessage('timeout') }
}

/**
 * Maps an error classification to a message safe to show a user — never the
 * raw error stack or Postgres message, which can leak internal schema
 * details.
 *
 * @param {'timeout'|'auth'|'schema'|'unknown'} kind
 * @returns {string}
 */
function toFriendlyMessage(kind) {
  switch (kind) {
    case 'timeout':
      return 'The database is taking longer than expected to respond. Please try again in a moment.'
    case 'auth':
      return 'A server configuration issue is preventing this request. Please contact support if this persists.'
    case 'schema':
      return 'A server configuration issue is preventing this request. Please contact support if this persists.'
    default:
      return 'Something went wrong while accessing the database. Please try again.'
  }
}

