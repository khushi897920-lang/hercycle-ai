/**
 * HerCycle AI — Centralized Logger
 * Provides structured, environment-filtered, and sanitized logs.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

// Helper to sanitize log messages or objects, replacing sensitive keys/tokens/passwords
function sanitize(args) {
  const SENSITIVE_KEYS = [
    'key', 'token', 'secret', 'password', 'service_role', 'apikey', 'bearer', 
    'clerk_secret_key', 'gemini_api_key', 'groq_api_key', 'supabase_service_role_key',
    'symptoms', 'mood', 'flow' // Mask personal medical/health data from logs
  ];

  return args.map(arg => {
    if (typeof arg === 'string') {
      // Regex replace sensitive information if it looks like a URL or key
      let sanitized = arg;
      for (const key of SENSITIVE_KEYS) {
        const regex = new RegExp(`(${key}\\s*[:=]\\s*)[^\\s&",;]+`, 'gi');
        sanitized = sanitized.replace(regex, `$1[REDACTED]`);
      }
      return sanitized;
    }

    if (arg && typeof arg === 'object') {
      try {
        const copy = JSON.parse(JSON.stringify(arg));
        const redactObject = (obj) => {
          for (const k in obj) {
            if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
              obj[k] = '[REDACTED]';
            } else if (obj[k] && typeof obj[k] === 'object') {
              redactObject(obj[k]);
            }
          }
        };
        redactObject(copy);
        return copy;
      } catch {
        return '[Unserializable Object - REDACTED]';
      }
    }

    return arg;
  });
}

export const logger = {
  info(...args) {
    console.log(`[INFO] [${new Date().toISOString()}]`, ...sanitize(args));
  },

  warn(...args) {
    console.warn(`[WARN] [${new Date().toISOString()}]`, ...sanitize(args));
  },

  error(...args) {
    console.error(`[ERROR] [${new Date().toISOString()}]`, ...sanitize(args));
  },

  debug(...args) {
    if (!IS_PROD) {
      console.log(`[DEBUG] [${new Date().toISOString()}]`, ...sanitize(args));
    }
  }
};
