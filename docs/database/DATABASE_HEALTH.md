# Database Health & Recommendations

This document outlines the health status, optimizations, and security suggestions for the HerCycle AI database.

---

## 1. Health Status Summary

* **Database Connection:** **Healthy.** Response times are low (~200ms) with no packet loss.
* **Schema Integrity:** **Healthy.** The database schema strictly holds clean data types and has a compound unique constraint on `daily_logs` to prevent daily entry duplication.
* **Redundant Elements:**
  * **Unused Tables:** None. Both `cycles` and `daily_logs` are actively queried.
  * **Dead Columns:** None. All columns in the remote database are mapped and utilized by the Next.js API endpoints.
  * **Unused Policies:** Since migrating to Clerk, the default Supabase RLS policies (e.g. `auth.uid() = user_id`) have been removed/disabled because the server communicates via the Service Role key.

---

## 2. Performance Optimizations

### Applied Performance Indexes
To prevent sequential table scans as the user base grows, the following indexes are configured:
1. `idx_cycles_user_id` on `cycles(user_id)`
2. `idx_daily_logs_user_id_date` on `daily_logs(user_id, date)`

### Additional Suggestions
* **Connection Pooling:** Ensure the Next.js database connection is pooled (using Supabase's built-in PgBouncer/Supavisor pooled port `6543`) to prevent serverless database connection exhaustion during peak traffic.
* **Query Limit Enforcement:** The API routes correctly limit read operations (e.g. `.limit(12)` on cycles, `.limit(30)` on logs). Keep these limits enforced to prevent reading large arrays into serverless memory.

---

## 3. Security Recommendations

### RLS Enforcement
* **Status:** Row Level Security (RLS) is enabled on all tables, and direct public/anonymous operations (using the `anon` key) are completely blocked.
* **Action:** Periodically audit policies to ensure no open read/write policies are accidentally created on public roles.

### Access Key Rotation
* **Recommendation:** Rotate the `SUPABASE_SERVICE_ROLE_KEY` every 180 days to mitigate risk from developer environment leaks. Ensure it is never committed to git or logged in console statements.

### Webhook Account Cleanup
* **Recommendation:** Implement a webhook listener on Clerk's `user.deleted` event. When a user deletes their Clerk account, send an automated transaction to Supabase to purge their corresponding records from the `cycles` and `daily_logs` tables to comply with data privacy policies (e.g., GDPR).
