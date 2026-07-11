/**
 * HerCycle AI — Environment Variables Validator
 * Runs on every call — no caching — so a missing key is caught immediately
 * regardless of when it disappears during the process lifetime.
 */

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(", ")}`
    );
  }
}