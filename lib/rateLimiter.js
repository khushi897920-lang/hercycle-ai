import { getAuthUserId } from './clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function createLimiter({ interval, maxRequests }) {
  return {
    async check(customLimitOrRequest, identifier) {
      let limit = maxRequests;
      let targetId = 'unknown';

      if (typeof customLimitOrRequest === 'number') {
        // Modern usage: check(limit, identifier)
        limit = customLimitOrRequest;
        targetId = identifier || 'unknown';
      } else if (customLimitOrRequest && typeof customLimitOrRequest.headers === 'object') {
        // Legacy/standard usage: check(request)
        targetId = await getRateLimitIdentifier(customLimitOrRequest);
      } else if (typeof customLimitOrRequest === 'string') {
        targetId = customLimitOrRequest;
      }

      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.rpc('enforce_rate_limit', {
          p_identifier: targetId,
          p_limit: limit,
          p_interval: interval
        });

        if (error) {
          console.error('Rate Limiter DB Error:', error.message || error);
          // Fail-open on DB errors to prevent site-wide outage if the rate table locks
          return;
        }

        if (data && !data.allowed) {
          throw new Error('Rate limit exceeded');
        }
      } catch (err) {
        if (err.message === 'Rate limit exceeded') {
          throw err;
        }
        console.error('Rate Limiter unexpected error:', err.message || err);
      }
    }
  };
}

export const aiLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 5 });
export const crudLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 30 });
export const devLimiter = createLimiter({ interval: 60 * 1000, maxRequests: 10 });

export async function getRateLimitIdentifier(request) {
  try {
    const userId = await getAuthUserId();
    if (userId) return `user:${userId}`;
  } catch (error) {
    console.warn('Failed to get user ID for rate limiting:', error.message);
  }
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

