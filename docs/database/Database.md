# Database Reference

This document summarizes the database schema, security rules, indexes, and connection settings.

---

## 1. Schema Definitions
* **`cycles` Table:**
  * `id` (UUID PRIMARY KEY, default `gen_random_uuid()`)
  * `user_id` (TEXT NOT NULL, index `idx_cycles_user_id`)
  * `start_date` (DATE NOT NULL)
  * `end_date` (DATE NULL)
  * `cycle_length` (INTEGER, default 28)
  * `created_at` (TIMESTAMPTZ, default `now()`)
* **`daily_logs` Table:**
  * `id` (UUID PRIMARY KEY, default `gen_random_uuid()`)
  * `user_id` (TEXT NOT NULL)
  * `date` (DATE NOT NULL)
  * `symptoms` (TEXT[] NULL)
  * `mood` (TEXT NULL)
  * `flow` (TEXT NULL)
  * `updated_at` (TIMESTAMPTZ, default `now()`)
  * **Constraints:** UNIQUE constraint `daily_logs_user_date_unique` on `(user_id, date)`.
  * **Index:** `idx_daily_logs_user_id_date` on `(user_id, date)`.

---

## 2. Row Level Security & Access
* **RLS Status:** Row Level Security (RLS) is enabled on all tables.
* **Anon Key access:** Direct reads and writes via the public anon key are completely blocked.
* **Server Access:** Serverless routes connect using the administrative `SUPABASE_SERVICE_ROLE_KEY` to query on behalf of users, bypassing RLS.

---

## 3. Connection Pooling Recommendations
In a serverless Next.js environment (such as Vercel), serverless functions scale rapidly. Every function instance creates its own database connection, which can quickly exhaust Supabase PostgreSQL connection limits.
* **Recommendation:** Update your production connection strings to use Supabase's built-in connection pooler (PgBouncer or Supavisor).
* **Port Mapping:** Use port `6543` (pooled connection port) instead of the direct database port `5432`.
* **String Syntax:** Replace standard transaction connection strings with the pooled session connection string inside your Vercel deployment environment variables.
