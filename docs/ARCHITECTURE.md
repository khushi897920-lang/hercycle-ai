# System Architecture Document

This document describes the high-level architecture, hybrid authentication model, and data flow of HerCycle AI.

---

## 1. High-Level System Design
HerCycle AI is a serverless application built with **Next.js (App Router)**, combining **Clerk** for user identity and **Supabase** for database storage. 

```
                                  +-------------------+
                                  |    Clerk Auth     |
                                  |  Identity/OAuth   |
                                  +---------+---------+
                                            ^
                                            | Session / User ID
                                            v
+-------------------+             +---------+---------+             +-------------------+
|  Client Browser   | <=========> | Next.js API Route | <=========> |    Supabase DB    |
|   (React Pages)   |  JSON API   | (Serverless Node) |  SQL Query  |   (PostgreSQL)    |
+-------------------+             +---------+---------+             +-------------------+
                                            ^
                                            | Request
                                            v
                                  +---------+---------+
                                  |     AI APIs       |
                                  | (Gemini & Groq)   |
                                  +-------------------+
```

---

## 2. Authentication & Data Security Model
Unlike standard Supabase architectures that query directly from the browser, HerCycle AI enforces a **strict backend-intermediary pattern**:

1. **Identity & JWTs:** Clerk manages registration, login (email/password + Google OAuth), and issues a short-lived JSON Web Token (JWT) representing the active user session.
2. **API Verification:** The Next.js API middleware/endpoints intercept incoming headers, verify the Clerk JWT, and extract the Clerk User ID (`user_...`).
3. **Database Access:** The Next.js server queries Supabase using the administrative `SUPABASE_SERVICE_ROLE_KEY`. Because it uses the service role key, the database connection **bypasses Row Level Security (RLS)**.
4. **Data Isolation:** Data isolation is enforced strictly on the server-side code by appending `.eq('user_id', userId)` to every Supabase select, insert, update, or delete query.
5. **Vulnerability Mitigation:** RLS is enabled on all PostgreSQL tables with no public policies, completely blocking direct client-side reads or writes using the public anon key.

---

## 3. Core Subsystems

### A. AI Chat Assistant Failover Subsystem
To ensure the AI chat assistant is robust, we implement a primary/fallback proxy model:
* **Primary Model:** Google Gemini 2.0 Flash (`gemini-2.0-flash`).
* **Fallback Model:** Groq LLaMA 3.1 8B (`llama-3.1-8b-instant`).
* **Logic:** The backend route `/api/chat` calls Gemini with an 8-second timeout. If it times out or throws an error, the handler automatically falls back to Groq with another 8-second timeout.

### B. Cascading Purge Subsystem (Idempotent Webhook)
When a user deletes their Clerk account, Clerk triggers a `user.deleted` webhook to `/api/webhooks/clerk`.
* **Verification:** The handler verifies the payload signature using the `svix` SDK.
* **Cascading Delete:** Once verified, the handler runs two queries in Supabase to delete all matching user rows from the `cycles` and `daily_logs` tables. 
* **Idempotency:** Deletes are filtered by `clerkUserId`, making them safe to re-run in case of network retries.

---

## 4. Database Schema Relationships
We maintain a clean Postgres schema:
* **`cycles` Table:** Tracks period start and end dates.
* **`daily_logs` Table:** Tracks daily symptoms, mood, and flow.
* **Logical Relation:** The tables are logically linked to the user account by the `user_id` text column matching the Clerk identifier. A compound unique constraint on `(user_id, date)` in the `daily_logs` table prevents duplicate entries.
