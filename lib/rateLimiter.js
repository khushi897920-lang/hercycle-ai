
import { getAuthUserId } from './clerk-server';

function createLimiter({ interval, maxRequests }) {
  const store = new Map();
  return {
    async check(request) {
      const identifier = await getRateLimitIdentifier(request);
      const now = Date.now();
      const record = store.get(identifier) || { count: 0, resetAt: now + interval };

      const { data, error } = await supabase.rpc('enforce_rate_limit', {
        p_identifier: targetId,
        p_limit: limit,
        p_interval: interval
      });

      record.count += 1;
      store.set(identifier, record);

      if (!data.allowed) {
        throw new Error('Rate limit exceeded');
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
