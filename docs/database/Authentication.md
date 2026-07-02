# Authentication Reference

This document summarizes the user session architecture and middleware route protection.

---

## 1. Clerk Authentication Architecture
All authentication states are managed externally via Clerk. 
* Next.js backend API routes extract the authenticated user identity via the session cookie/bearer token using the server-side SDK.
* Route handler check:
  ```javascript
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```

---

## 2. Middleware Route Matching
Clerk middleware resides in [proxy.js](file:///d:/Documents/Projects/HerCycle%20org/proxy.js):
* **Protected Routes:** All layout pages (e.g., `/`, `/track`, `/insights`, `/chat`) are protected by the middleware. Unauthenticated requests are redirected to the Clerk sign-in page.
* **Public Routes:**
  * Login / Signup pages (`/auth/login`, `/auth/signup`).
  * OAuth Callbacks (`/auth/callback`).
  * API Routes (`/api/*`). API routes are explicitly designated as public in the middleware to allow the endpoints to handle authentication failures natively and return a clean JSON `401` or `403` status instead of triggering an HTML redirect.

---

## 3. Idempotent Data Purging on Account Deletion
When a user deletes their account:
1. Clerk triggers a `user.deleted` webhook POST request to `/api/webhooks/clerk`.
2. The server verifies the cryptographic signature of the webhook using the `svix` package and your `CLERK_WEBHOOK_SECRET`.
3. If verified, the server purges all database records associated with the user's Clerk ID from the `cycles` and `daily_logs` tables in a single transaction.
4. The deletion query uses `clerkUserId` filters, making the operation safe to run repeatedly (idempotent).
