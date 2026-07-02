# Security Reference

This document summarizes the security controls implemented in HerCycle AI.

---

## 1. Authentication & Authorization
* **Provider:** Clerk Authentication.
* **Sensitive API Routes:** `/api/chat`, `/api/cycles`, `/api/log-day`, `/api/log-day/all`, `/api/pcod-risk`, `/api/predict-cycle` require valid Clerk session JWTs. Unauthenticated requests are rejected with a `401 Unauthorized` response.
* **Development-only Routes:** `/api/test-db` and `/api/seed` are disabled in production (`process.env.NODE_ENV === 'production'`) and return `403 Forbidden`.

---

## 2. Webhook Integrity
* **Endpoint:** `/api/webhooks/clerk`
* **Signature Verification:** The endpoint uses Clerk's official standard `svix` library to verify the cryptographic signature of incoming webhooks using the `CLERK_WEBHOOK_SECRET` signing key. Any request with a missing or invalid signature is rejected with `400 Bad Request`.
* **Idempotency:** Webhook event handlers are written to be idempotent. Cascading deletions are run using filter constraints ensuring that duplicate events do not cause database integrity issues.

---

## 3. Rate Limiting
* **Strategy:** In-memory sliding window rate limiter implemented in [lib/rate-limiter.js](file:///d:/Documents/Projects/HerCycle%20org/lib/rate-limiter.js).
* **Limits:**
  * **Chat Assistant (`/api/chat`):** 10 requests/minute per authenticated user.
  * **Cycles updates (`/api/cycles` POST/PATCH):** 30 requests/minute per authenticated user.
  * **Daily log updates (`/api/log-day` POST):** 30 requests/minute per authenticated user.
  * **Prediction generator (`/api/predict-cycle` POST):** 20 requests/minute per authenticated user.
* **Actions:** Returns `429 Too Many Requests` when limits are exceeded.

---

## 4. Input Validation
* **Library:** Zod schemas are defined for all write routes (POST/PATCH) to reject malformed JSON, invalid date formats, out-of-bounds numbers, and overflow strings before querying the database.
* **Response:** Returns `400 Bad Request` with detailed validation error fields.
