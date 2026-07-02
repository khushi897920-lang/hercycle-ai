/**
 * HerCycle AI — Lightweight In-Memory Rate Limiter
 * 
 * ⚠️ WARNING:
 * This limiter is NOT suitable for distributed/serverless production deployments (like Vercel serverless).
 * The memory state is isolated to each serverless container and is lost when the container recycles.
 * Replace with Redis/Upstash if scaling to multiple instances or serverless.
 */

const rateLimits = new Map();

// Periodic cleanup of stale rate limit windows to prevent memory leaks (every 5 minutes)
if (typeof global !== 'undefined') {
  if (!global.rateLimitCleanupInterval) {
    global.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, window] of rateLimits.entries()) {
        // Remove windows older than 1 minute
        if (now - window.timestamp > 60000) {
          rateLimits.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }
}

/**
 * Checks if a request exceeds the configured limit.
 * @param {string} key Unique identifier for the client (e.g., Clerk user ID)
 * @param {string} route The identifier for the rate limit configuration (e.g., 'chat', 'prediction')
 * @param {number} limit Maximum requests allowed in the 1-minute window
 * @returns {boolean} True if allowed, false if rate limited
 */
export function isAllowed(key, route, limit) {
  const now = Date.now();
  const cacheKey = `${key}:${route}`;
  
  let userWindow = rateLimits.get(cacheKey);
  
  if (!userWindow || now - userWindow.timestamp > 60000) {
    // New window or window expired
    userWindow = {
      timestamp: now,
      requests: 0
    };
  }
  
  userWindow.requests += 1;
  rateLimits.set(cacheKey, userWindow);
  
  return userWindow.requests <= limit;
}
