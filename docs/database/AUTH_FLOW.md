# Authentication & Session Flow

This document details the hybrid authentication flow combining **Clerk** (identity provider) and **Supabase** (database storage).

---

## 1. Clerk Authentication
Clerk acts as the external identity provider for HerCycle AI. It handles:
* Sign Up, Login, and Password Resets.
* Multi-factor Authentication (MFA) and Session Verification.
* Social OAuth (e.g., Google login).
* Session token issuance.

---

## 2. Session Flow Walkthrough

```
[Browser]                     [Next.js Server API]               [Clerk API]              [Supabase DB]
    │                                  │                              │                         │
    │ 1. Request API Route             │                              │                         │
    ├─────────────────────────────────>│                              │                         │
    │    (Includes Clerk Session JWT)  │ 2. Validate JWT              │                         │
    │                                  ├─────────────────────────────>│                         │
    │                                  │ <────────────────────────────┤                         │
    │                                  │    Return User Session Info  │                         │
    │                                  │                              │                         │
    │                                  │ 3. Extract Clerk User ID     │                         │
    │                                  │    (e.g., "user_3FV2...")    │                         │
    │                                  │                              │                         │
    │                                  │ 4. Query DB with filter:     │                         │
    │                                  │    user_id = Clerk User ID   │                         │
    │                                  ├──────────────────────────────┼────────────────────────>│
    │                                  │                              │                         │ (Bypasses RLS via
    │                                  │ <────────────────────────────┼─────────────────────────┤  Service Role Key)
    │                                  │    Return User Data Rows     │                         │
    │ 5. Response Payload (JSON)       │                              │                         │
    |<─────────────────────────────────┤                              │                         │
```

---

## 3. How Clerk User IDs Map to Database Records
1. When a user logs in, Clerk assigns them a unique, persistent string identifier starting with `user_` (e.g., `user_3FV2opwmxi914v7Hzb7NHS7nQVN`).
2. When the user interacts with the app, Next.js calls `auth()` or `getAuthUserId()` to fetch this ID on the server.
3. Every row inserted into the `cycles` or `daily_logs` table has its `user_id` column set to this exact string.
4. When querying the tables, the server appends a `.eq('user_id', userId)` filter to restrict data retrieval strictly to the authenticated user's records.

---

## 4. Why the Service Role Key is Used
Because Clerk manages the user sessions, the database is queried using the **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`). 
* **RLS Bypass:** The Service Role key represents a superuser role that automatically bypasses all Row Level Security (RLS) checks in Supabase.
* **Why this is necessary:** Since Clerk JWTs are not native Supabase Auth JWTs, Supabase's built-in `auth.uid()` helper is blind to Clerk users. The backend API routes must run as a trusted administrator, fetch the user ID from Clerk, and manually filter the queries.

---

## 5. Why the Anon Key Must Not Write Directly
* **Bypassed Security Checks:** The public Anon key is exposed in the frontend bundle. If the database allowed writes via the Anon key (by disabling RLS or having public write policies), an attacker could query, insert, or delete any record in the database by sending HTTP requests directly to the Supabase endpoint.
* **Security Enforcement:** By enabling RLS and leaving no public policies, the Anon key is completely blocked from accessing tables. All client data access is forced through the Next.js backend API, which strictly validates Clerk session tokens before allowing operations.
