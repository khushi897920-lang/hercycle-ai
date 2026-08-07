import { getAuthUserId } from './clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildAnonymousIdentifier,
  consume,
  extractClientIp,
} from '@/lib/rate-limiter';
import { AsyncLocalStorage } from 'node:async_hooks';
import { NextResponse } from 'next/server';

const rateLimitStorage = new AsyncLocalStorage();

// Patch NextResponse.json to automatically append rate limit headers if present in context
if (NextResponse.json) {
  const originalJson = NextResponse.json;
  NextResponse.json = function (body, init) {
    const response = originalJson.call(this, body, init);
    const headersData = rateLimitStorage.getStore();
    if (headersData) {
      for (const [key, value] of Object.entries(headersData)) {
        response.headers.set(key, String(value));
      }
    }
    return response;
  };
}

/**
 * Creates a limiter backed by the `enforce_rate_limit` Postgres RPC.
 *
 * When that backend is unavailable the limiter degrades to the in-process
 * counter in `lib/rate-limiter.js` rather than allowing the request. See
 * {@link enforceLimit} for why.
 *
 * @param {{ interval: number, maxRequests: number, name?: string, getClient?: () => object }} config
 * @param {() => object} [config.getClient] injection seam for tests; defaults to
 *   the shared Supabase admin client
 */
export function createLimiter({ interval, maxRequests, name = 'default', getClient = getSupabaseAdmin }) {
  return {
    async check(customLimitOrRequest, identifier) {
      let limit = maxRequests;
      let targetId = null;

      if (typeof customLimitOrRequest === 'number') {
        // Modern usage: check(limit, identifier)
        limit = customLimitOrRequest;
        targetId = identifier || null;
      } else if (customLimitOrRequest && typeof customLimitOrRequest.headers === 'object') {
        // Legacy/standard usage: check(request)
        targetId = await getRateLimitIdentifier(customLimitOrRequest);
      } else if (typeof customLimitOrRequest === 'string') {
        targetId = customLimitOrRequest;
      }

      // A caller that could not be identified at all still has to land in a
      // real bucket. `unknown` is a stable string, so it behaves as one shared
      // strict bucket rather than as an exemption.
      if (!targetId) targetId = 'unknown';

      const decision = await enforceLimit({ getClient, targetId, limit, interval, name });

      const reset = Math.ceil(decision.resetAt / 1000);
      const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));

      const rateLimitHeaders = {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': String(reset)
      };

      // Only advertise Retry-After when the caller actually has to wait, so a
      // successful response is not decorated with a misleading hint.
      if (!decision.allowed) {
        rateLimitHeaders['Retry-After'] = String(retryAfterSeconds);
      }

      // Transition context
      rateLimitStorage.enterWith(rateLimitHeaders);

      if (!decision.allowed) {
        throw new Error('Rate limit exceeded');
      }
    }
  };
}

/**
 * Resolves one allow/deny decision.
 *
 * The database is authoritative when it answers. When it does not — an RPC
 * error, a thrown client error, or a success with no payload (which is what a
 * missing `enforce_rate_limit` function looks like on a fresh install) — the
 * decision falls through to the in-process counter.
 *
 * The previous implementation initialised `allowed = true` and only ever
 * assigned it from a successful RPC, so every one of those failure paths
 * allowed the request. That turned a database incident into a total loss of
 * rate limiting across the app, including on the AI endpoints that spend money
 * per call.
 *
 * @param {{ getClient: () => object, targetId: string, limit: number, interval: number, name: string }} params
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number, degraded: boolean }>}
 */
async function enforceLimit({ getClient, targetId, limit, interval, name }) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase.rpc('enforce_rate_limit', {
      p_identifier: targetId,
      p_limit: limit,
      p_interval: interval
    });

    if (error) {
      console.error('Rate Limiter DB Error:', error.message || error);
    } else if (data && typeof data.allowed === 'boolean') {
      const count = data.count || 1;
      const resetAt = data.reset_at
        ? new Date(data.reset_at).getTime()
        : Date.now() + interval;

      return {
        allowed: data.allowed,
        remaining: Math.max(0, limit - count),
        resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + interval,
        degraded: false
      };
    } else {
      console.error('Rate Limiter DB Error: enforce_rate_limit returned no decision');
    }
  } catch (err) {
    console.error('Rate Limiter unexpected error:', err.message || err);
  }

  // Degraded mode. Per-container state means a fleet of N containers enforces
  // at most N x `limit`, which is a far smaller hole than the unlimited one it
  // replaces.
  console.warn(`[Rate Limit] Falling back to the in-memory limiter for "${name}".`);
  const local = consume(`${name}:${targetId}`, { limit, intervalMs: interval });

  return {
    allowed: local.allowed,
    remaining: local.remaining,
    resetAt: local.resetAt,
    degraded: true
  };
}

export const aiLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 5, name: 'ai' });
export const crudLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 30, name: 'crud' });
export const devLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 10, name: 'dev' });

// Re-exported so existing importers of `@/lib/rateLimiter` keep working; the
// implementation now lives in the framework-free `@/lib/rate-limiter`.
export { extractClientIp, buildAnonymousIdentifier };

/**
 * Resolves the bucket a request should be counted against, most specific first:
 *
 *  1. the authenticated Clerk user,
 *  2. the client IP as reported by the proxy stack,
 *  3. a stable fingerprint derived from the request's own headers.
 *
 * Step 3 used to be `anon:${Math.random()...}`, which handed every
 * unattributable request a private bucket and therefore exempted it from the
 * limit entirely. See `buildAnonymousIdentifier` for why a coarse shared bucket
 * is the right failure mode here.
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
export async function getRateLimitIdentifier(request) {
  try {
    const userId = await getAuthUserId();
    if (userId) return `user:${userId}`;
  } catch (error) {
    console.warn('Failed to get user ID for rate limiting:', error.message);
  }

  const ip = extractClientIp(request);
  if (ip) return `ip:${ip}`;

  return buildAnonymousIdentifier(request);
}

