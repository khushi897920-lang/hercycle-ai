# Database Schema Reference

This document provides a detailed schema reference for the tables in the HerCycle AI database.

---

## 1. Table: `cycles`

### Purpose
Stores the start and end dates of user menstrual cycles, allowing the system to track period history and calculate predicted future cycles.

### Columns
| Column Name | Data Type | Nullable | Default Value | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Unique primary key for each cycle entry |
| `user_id` | `TEXT` | NO | *None* | Clerk User ID associated with the record |
| `start_date` | `DATE` | NO | *None* | The start date of the period cycle |
| `end_date` | `DATE` | YES | *None* | The end date of the period cycle (null if period is active/ongoing) |
| `cycle_length`| `INTEGER` | YES | `28` | The length of the cycle in days |
| `created_at` | `TIMESTAMPTZ`| YES | `now()` | Timestamp when the record was created |

### Keys & Constraints
* **Primary Key:** `id` (UUID)
* **Foreign Keys:** None (Managed application-side using Clerk User IDs)
* **Unique Constraints:** None

### Indexes
* `cycles_pkey`: UNIQUE B-tree on `id` (Primary Key index)
* `idx_cycles_user_id`: B-tree on `user_id` (Optimizes queries filtering cycles by user)

### Triggers & Functions
* None

### Row Level Security (RLS) Policies
* **RLS Status:** Enabled
* **Policies:** None (All public/anonymous read and write operations are blocked. Server-side API routes bypass RLS using the `SUPABASE_SERVICE_ROLE_KEY`).

### Example Row
```json
{
  "id": "db46d9b1-f997-433b-9289-ea913e53d88b",
  "user_id": "user_3FV2opwmxi914v7Hzb7NHS7nQVN",
  "start_date": "2026-06-22",
  "end_date": "2026-06-22",
  "cycle_length": 28,
  "created_at": "2026-06-22T16:41:19.47+00:00"
}
```

---

## 2. Table: `daily_logs`

### Purpose
Stores daily symptoms, mood, and flow intensity logged by the user on any given calendar day.

### Columns
| Column Name | Data Type | Nullable | Default Value | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Unique primary key for each log entry |
| `user_id` | `TEXT` | NO | *None* | Clerk User ID associated with the record |
| `date` | `DATE` | NO | *None* | The calendar date of the log |
| `symptoms` | `TEXT[]` | YES | *None* | Array of symptoms logged (e.g., `["Cramps", "Fatigue"]`) |
| `mood` | `TEXT` | YES | *None* | Single emoji or text representation of user mood (e.g., `😢`, `😊`) |
| `flow` | `TEXT` | YES | *None* | Flow intensity code (e.g., `f1` for Light, `f2` for Medium, `f3` for Heavy) |
| `updated_at` | `TIMESTAMPTZ`| YES | `now()` | Timestamp when the record was last updated |

### Keys & Constraints
* **Primary Key:** `id` (UUID)
* **Foreign Keys:** None (Managed application-side using Clerk User IDs)
* **Unique Constraints:** `daily_logs_user_date_unique` on `(user_id, date)` (Prevents duplicate logs for the same day)

### Indexes
* `daily_logs_pkey`: UNIQUE B-tree on `id` (Primary Key index)
* `idx_daily_logs_user_id_date`: B-tree on `(user_id, date)` (Optimizes daily log fetch and upsert checks)

### Triggers & Functions
* None

### Row Level Security (RLS) Policies
* **RLS Status:** Enabled
* **Policies:** None (All public/anonymous read and write operations are blocked. Server-side API routes bypass RLS using the `SUPABASE_SERVICE_ROLE_KEY`).

### Example Row
```json
{
  "id": "bf01712e-5653-46cb-a0b9-005545cfa0cb",
  "user_id": "user_3FV2opwmxi914v7Hzb7NHS7nQVN",
  "date": "2026-06-22",
  "symptoms": ["Bloating", "Nausea", "Fatigue", "Headache"],
  "mood": "😐",
  "flow": "f3",
  "updated_at": "2026-06-22T17:42:27.733+00:00"
}
```
