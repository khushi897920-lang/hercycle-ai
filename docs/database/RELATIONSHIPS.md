# Database Relationships

This document outlines the logical relationships between entities in the HerCycle AI database.

---

## 1. Entity Relationship Model
The database implements a decentralized user schema. Authentication and user accounts are managed by Clerk, which lives outside Supabase. The database stores the related domain data (`cycles` and `daily_logs`) referencing the Clerk user via a `user_id` string field.

### Logical Entity-Relationship Diagram

```
  [Clerk User Account] 
          │
          │ (1 : Many, logical reference via user_id)
          ├─────────────────────────────────────────┐
          ▼                                         ▼
   ┌──────────────┐                          ┌──────────────┐
   │    cycles    │                          │  daily_logs  │
   ├──────────────┤                          ├──────────────┤
   │ id (PK)      │                          │ id (PK)      │
   │ user_id      │                          │ user_id      │
   │ start_date   │                          │ date         │
   │ end_date     │                          │ symptoms     │
   │ cycle_length │                          │ mood         │
   │ created_at   │                          │ flow         │
   └──────────────┘                          │ updated_at   │
                                             └──────────────┘
```

---

## 2. Relationship Explanations

### A. Clerk User ───> `cycles` (1 : Many)
* **Type:** Logical 1-to-many relationship.
* **Keys:** The database references the Clerk account via the `cycles.user_id` column (`TEXT`).
* **Cascade Behavior:** Because Clerk accounts reside in an external provider, there is no database-enforced foreign key constraint (`FOREIGN KEY ... REFERENCES`). Account deletions must be handled at the application layer (e.g., via a Clerk webhook or manual deletion scripts) to clean up orphan records in Supabase.
* **Description:** A single user can have multiple historical cycle logs representing their period history over time.

### B. Clerk User ───> `daily_logs` (1 : Many)
* **Type:** Logical 1-to-many relationship with a daily uniqueness constraint.
* **Keys:** The database references the Clerk account via the `daily_logs.user_id` column (`TEXT`).
* **Constraints:** A unique constraint (`daily_logs_user_date_unique`) is enforced on `(user_id, date)`. This ensures that while a user can have many logs over time, they can only have **one log per calendar date**.
* **Description:** A single user can log symptoms for any calendar day. When they modify symptoms for an existing date, the application performs an `UPSERT` to overwrite the existing log for that specific date.
