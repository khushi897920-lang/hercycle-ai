/**
 * HerCycle AI — Environment Variables Validator
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

let validated = false;

export function validateEnv() {
  if (validated) return;

  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    const errorMsg =
      "\n======================================================\n" +
      "🔥 CRITICAL CONFIGURATION ERROR: Missing required environment variables:\n" +
      missing.map(v => `  - ${v}`).join("\n") +
      "\n======================================================\n";

    console.error(errorMsg);

    throw new Error(
      `Missing required configuration: ${missing.join(", ")}`
    );
  }

  validated = true;
}