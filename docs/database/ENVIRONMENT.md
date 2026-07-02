# Environment Variables Reference

This document covers all required environment variables and validation mechanisms.

---

## 1. Fail-Fast Environment Validation
To prevent runtime database and API crashes, environment variables are validated at server startup using [lib/env.js](file:///d:/Documents/Projects/HerCycle%20org/lib/env.js).
* If any required variable is missing, the Next.js server logs a critical error to console and throws an exception, failing immediately.
* Imported at the top of:
  * [proxy.js](file:///d:/Documents/Projects/HerCycle%20org/proxy.js) (Middleware)
  * [app/layout.js](file:///d:/Documents/Projects/HerCycle%20org/app/layout.js) (Root Layout)

---

## 2. Environment Variables List

### Supabase Integration
* `NEXT_PUBLIC_SUPABASE_URL`: Public API endpoint URL.
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous client key (RLS blocked).
* `SUPABASE_SERVICE_ROLE_KEY`: Server-only administrative key that bypasses RLS.

### Clerk Authentication
* `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Public key to load Clerk provider on the browser.
* `CLERK_SECRET_KEY`: Server-only secret key to sign/verify session JWTs.
* `CLERK_WEBHOOK_SECRET`: Server-only key used to sign webhooks in Clerk dashboard and verify signatures via the `svix` SDK.

### AI APIs
* `GEMINI_API_KEY`: Primary Google Gemini API key.
* `GROQ_API_KEY`: Fallback Groq LLaMA API key (optional).
