# API Reference & Hardening Details

This document covers the details of the hardened endpoints, including authentication constraints, rate limits, and Zod payloads.

---

## 1. Endpoints Overview

### `/api/chat` (POST)
* **Auth:** Required (Clerk session token).
* **Rate Limit:** 10 requests/minute.
* **Payload Validation (Zod):**
  ```json
  {
    "language": "string (max 10, optional)",
    "message": "string (min 1, max 1000, required)",
    "context": {
      "nextPeriodDate": "string (max 50, optional)",
      "averageCycleLength": "number (optional)",
      "currentPhase": {
        "day": "number (optional)",
        "phase": "string (max 50, optional)"
      }
    }
  }
  ```

### `/api/cycles` (GET / POST / PATCH)
* **Auth:** Required.
* **Rate Limit:** 30 requests/minute for write operations (POST and PATCH).
* **Payload Validation (Zod):**
  * **POST:**
    ```json
    {
      "start_date": "YYYY-MM-DD (regex match, required)",
      "end_date": "YYYY-MM-DD (regex match, optional)",
      "cycle_length": "integer (21 to 45, optional)"
    }
    ```
  * **PATCH:**
    ```json
    {
      "id": "UUID (required)",
      "end_date": "YYYY-MM-DD (regex match, required)"
    }
    ```

### `/api/log-day` (GET / POST)
* **Auth:** Required.
* **Rate Limit:** 30 requests/minute for updates (POST).
* **Payload Validation (Zod):**
  * **POST:**
    ```json
    {
      "date": "YYYY-MM-DD (regex match, required)",
      "symptoms": "array of strings (max 50 strings, max length 100 per string, required)",
      "mood": "string (max 50, optional)",
      "flow": "string (max 10, optional)"
    }
    ```

### `/api/log-day/all` (GET)
* **Auth:** Required.
* **Rate Limit:** Standard.

### `/api/pcod-risk` (GET)
* **Auth:** Required.
* **Rate Limit:** Standard.

### `/api/predict-cycle` (POST)
* **Auth:** Required.
* **Rate Limit:** 20 requests/minute.

### `/api/test-db` (GET) & `/api/seed` (GET)
* **Auth:** Required.
* **Environment Constraint:** Blocked in production (`NODE_ENV === 'production'`). Returns `403 Forbidden`.

### `/api/webhooks/clerk` (POST)
* **Auth:** Webhook Signature Verification (`svix` SDK using `CLERK_WEBHOOK_SECRET`).
* **Rate Limit:** Exempt.
* **Payload Validation:** Handled by Svix signature verify check. Processes `user.deleted` event.
