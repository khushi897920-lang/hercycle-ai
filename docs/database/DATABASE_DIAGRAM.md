# Database ER Diagram

This document contains the ASCII Entity-Relationship diagram for the HerCycle AI database.

---

## ASCII Entity-Relationship Diagram

```
 +--------------------------------------------------------------------+
 |                              CLERK                                 |
 |                      External Auth Provider                        |
 |                                                                    |
 |  +--------------------------------------------------------------+  |
 |  | User Account                                                 |  |
 |  | - id: TEXT (PK)  -------------------┐                        |  |
 |  +-------------------------------------+                        |  |
 +----------------------------------------│---------------------------+
                                          │
                        ┌─────────────────┴─────────────────┐
                        │ (Logical 1-to-many references)    │
                        ▼                                   ▼
          +---------------------------+       +---------------------------+
          |          CYCLES           |       |        DAILY_LOGS         |
          +---------------------------+       +---------------------------+
          | PK | id: UUID             |       | PK | id: UUID             |
          |    | user_id: TEXT        |       |    | user_id: TEXT        |
          |    | start_date: DATE     |       |    | date: DATE           |
          |    | end_date: DATE       |       |    | symptoms: TEXT[]     |
          |    | cycle_length: INT    |       |    | mood: TEXT           |
          |    | created_at: TIMESTAMPTZ      |    | flow: TEXT           |
          +---------------------------+       |    | updated_at: TIMESTAMPTZ
                                              +---------------------------+
                                              | UK | (user_id, date)      |
                                              +---------------------------+
```

---

## Diagram Key & Explanations

* **PK:** Primary Key (Unique row identifier).
* **UK:** Unique Key / Constraint (Prevents double entries).
* **Logical Line (───):** Represents an application-enforced relationship. The application verifies user authentication in the API routes using Clerk, then queries Supabase using the resolved Clerk User ID as a string parameter.
