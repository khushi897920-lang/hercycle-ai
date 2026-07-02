/**
 * HerCycle AI — Environment Variables Validator
 * Validates the presence of required environment variables.
 * Throws a descriptive error if any variables are missing.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'GEMINI_API_KEY'
];

export function validateEnv() {
  const missing = [];
  
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    const errorMsg = `\n======================================================\n` +
      `🔥 CRITICAL CONFIGURATION ERROR: Missing required environment variables:\n` +
      missing.map(v => `  - ${v}`).join('\n') +
      `\n======================================================\n`;
    console.error(errorMsg);
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Execute immediately when imported
validateEnv();
