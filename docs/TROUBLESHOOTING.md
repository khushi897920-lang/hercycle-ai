# Troubleshooting Guide

This guide helps you diagnose and resolve common errors encountered during development or deployment.

---

## 1. Clerk Authentication Errors

### A. Infinite Redirect Loops on Sign-in
* **Symptoms:** The browser redirects repeatedly between `/auth/login` and the dashboard.
* **Causes:** Incorrect route matchers in `proxy.js` or missing keys in `.env.local`.
* **Fixes:**
  1. Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are correct.
  2. Verify Clerk dashboard has the correct redirect URLs (e.g. `http://localhost:3000/auth/callback` in local dev).

### B. Clerk SDK throwing "Invalid secret key"
* **Symptoms:** API calls return 500 and the server logs print signature validation exceptions.
* **Fix:** Double-check that your `CLERK_SECRET_KEY` in `.env.local` matches the key in the Clerk Dashboard. Ensure there are no spaces or newlines at the end of the string.

---

## 2. Supabase Database Errors

### A. "PGRST116" or "relation does not exist"
* **Symptoms:** Cycles or Daily Logs page shows database errors or logs `PGRST116`.
* **Causes:** The required tables (`cycles`, `daily_logs`) have not been created in the connected database schema.
* **Fix:** Open Supabase SQL Editor and run the SQL migration script from [DATABASE_EXPORT.sql](file:///d:/Documents/Projects/HerCycle%20org/docs/database/DATABASE_EXPORT.sql).

### B. "row violates row-level security policy"
* **Symptoms:** Write operations using client-side code fail.
* **Causes:** Row Level Security (RLS) is enabled, but the query did not use the admin bypass client or bypass checks.
* **Fix:** Confirm all database queries are initiated server-side via Next.js API routes using `getSupabaseAdmin()`. Client-side direct database calls are blocked.

---

## 3. Webhook Signature Mismatches
* **Symptoms:** `/api/webhooks/clerk` returns `400 Bad Request` during testing or when receiving Clerk events.
* **Causes:**
  1. The webhook request header lacks `svix-id`, `svix-timestamp`, or `svix-signature`.
  2. The `CLERK_WEBHOOK_SECRET` variable in `.env.local` does not match the Clerk Dashboard signing secret.
* **Fix:** Go to Clerk Dashboard -> Webhooks -> Select endpoint, copy the Signing Secret, and paste it into `.env.local` as `CLERK_WEBHOOK_SECRET`.

---

## 4. AI Provider Timeout / Failure
* **Symptoms:** AI Chat returns the polite fallback text (*"I apologize, but I am experiencing a technical hiccup..."*).
* **Causes:** Gemini API Key is invalid or rate limited, and the Groq fallback key is also missing or invalid.
* **Fix:** Open `.env.local` and confirm `GEMINI_API_KEY` is defined. Verify your keys are active on the respective AI dashboards (AI Studio & Groq Console).
