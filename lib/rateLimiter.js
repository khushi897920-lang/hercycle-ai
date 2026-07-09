// import { LRUCache } from 'lru-cache';
// import { getAuthUserId } from './clerk-server';

// function rateLimit(options) {
//   const tokenCache = new LRUCache({
//     max: options?.uniqueTokenPerInterval || 500,
//     ttl: options?.interval || 60000,
//   });

//   return {
//     check: (limit, token) =>
//       new Promise((resolve, reject) => {
//         const tokenCount = (tokenCache.get(token) || 0) + 1;
//         tokenCache.set(token, tokenCount);
//         const isRateLimited = tokenCount > limit;
//         if (isRateLimited) {
//           return reject(new Error('Rate limit exceeded'));
//         }
//         return resolve();
//       }),
//   };
// }
// /**
//  * Rate limiter for AI/ML routes (chat, PCOD risk, cycle prediction)
//  * These are the most expensive operations that call external APIs or run ML inference
//  */
// export const aiLimiter = rateLimit({
//   interval: 60 * 1000, // 60 seconds
//   uniqueTokenPerInterval: 500, // Max 500 concurrent users tracked
// });

// /**
//  * Rate limiter for standard CRUD routes (cycles, daily logs)
//  * These are lighter database operations
//  */
// export const crudLimiter = rateLimit({
//   interval: 60 * 1000, // 60 seconds
//   uniqueTokenPerInterval: 500,
// });

// /**
//  * Rate limiter for dev/test routes (seed, test-db)
//  * Very restrictive to discourage production usage
//  */
// export const devLimiter = rateLimit({
//   interval: 60 * 1000, // 60 seconds
//   uniqueTokenPerInterval: 100, // Fewer concurrent users expected
// });

// /**
//  * Get unique identifier for rate limiting
//  * Prefers user ID from Clerk auth, falls back to IP address
//  *
//  * @param {Request} request - Next.js request object
//  * @returns {Promise<string>} Unique identifier (user ID or IP)
//  */
// export async function getRateLimitIdentifier(request) {
//   try {
//     // Try to get authenticated user ID first
//     const userId = await getAuthUserId();
//     if (userId) {
//       return `user:${userId}`;
//     }
//   } catch (error) {
//     console.warn('Failed to get user ID for rate limiting:', error.message);
//   }

//   // Fallback to IP address for unauthenticated requests
//   const forwarded = request.headers.get('x-forwarded-for');
//   const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
//   return `ip:${ip}`;
// }


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
