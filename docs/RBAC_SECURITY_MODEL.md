# Security Model: Role-Based Access Control (RBAC) for Teams

## Overview
HerCycle AI implements multi-tenant **Role-Based Access Control (RBAC)** to ensure secure team collaboration across ML telemetry, dataset versioning, hyper-parameter sweeps, and organization management.

---

## Roles & Permission Sets

The platform enforces four granular roles:

| Role | Description | Permission Set |
| :--- | :--- | :--- |
| **`viewer`** | Read-only auditor or stakeholder | `VIEW_TELEMETRY`, `VIEW_LINEAGE`, `VIEW_SWEEPS`, `VIEW_TEAM` |
| **`runner`** | ML Operator / Evaluator | `viewer` + `RUN_SWEEPS`, `RUN_EXPERIMENTS` |
| **`editor`** | Data Scientist / Model Engineer | `runner` + `CREATE_DATASETS`, `CREATE_SWEEPS`, `EDIT_MODELS` |
| **`admin`** | Team Owner / Organization Lead | `editor` + `MANAGE_TEAM`, `INVITE_MEMBERS`, `MANAGE_ROLES` |

---

## API Permission Guards

API routes inspect user authentication session context or `x-user-role` headers and enforce permissions via `verifyRbacPermission`:

| API Endpoint | Method | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `/api/dashboard/metrics` | `GET` | `VIEW_TELEMETRY` | Viewer, Runner, Editor, Admin |
| `/api/dashboard/lineage` | `GET` | `VIEW_LINEAGE` | Viewer, Runner, Editor, Admin |
| `/api/dashboard/lineage` | `POST` | `CREATE_DATASETS` | Editor, Admin |
| `/api/dashboard/sweeps` | `GET` | `VIEW_SWEEPS` | Viewer, Runner, Editor, Admin |
| `/api/dashboard/sweeps` | `POST` | `CREATE_SWEEPS` | Editor, Admin |
| `/api/dashboard/sweeps/[id]/trigger` | `POST` | `RUN_SWEEPS` | Runner, Editor, Admin |
| `/api/admin/team` | `GET` | `VIEW_TEAM` | Viewer, Runner, Editor, Admin |
| `/api/admin/team` | `POST` | `MANAGE_TEAM` | Admin |
| `/api/admin/team` | `PATCH` | `MANAGE_TEAM` | Admin |
| `/api/admin/team` | `DELETE` | `MANAGE_TEAM` | Admin |

---

## Database Security (Supabase SQL)

The schema enforces integrity through PostgreSQL constraints and Row-Level Security (RLS):

- **`public.teams`**: Defines team entities with unique slug constraints.
- **`public.team_members`**: Establishes unique `(team_id, user_id)` relationships and role checks (`CHECK (role IN ('viewer', 'runner', 'editor', 'admin'))`).
