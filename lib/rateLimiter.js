
import { getAuthUserId } from './clerk-server';

const rateLimitStore = new Map();

function createLimiter({ interval, maxRequests }) {
  return {
    async check(request) {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

      const now = Date.now();
      const record = rateLimitStore.get(ip) || { count: 0, resetAt: now + interval };

      if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + interval;
      }

      record.count += 1;
      rateLimitStore.set(ip, record);

      if (record.count > maxRequests) {
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
