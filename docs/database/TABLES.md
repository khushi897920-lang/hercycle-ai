# Database Tables Reference

This document explains the business context, access permissions, and application dependencies for each database table in HerCycle AI.

---

## 1. Table: `cycles`

### Why It Exists
The `cycles` table records historical menstruation periods. Each row represents a single period entry with a start date and an end date. This data is critical for calculating average cycle lengths, predicting the start date of the next period, assessing confidence scores, and determining irregular cycle patterns.

### Read Access
* **Read by:** Next.js Serverless API routes (bypassing RLS with the service role key).
* **Audience:** The authenticated user whose Clerk ID matches the `user_id` of the rows.

### Write Access
* **Written by:** Next.js Serverless API routes (bypassing RLS with the service role key).
* **Audience:** The authenticated user (performing inserts or updates via the frontend).

### API Dependencies
* `GET /api/cycles` — Retrieves up to 12 recent cycles to display on the tracker and dashboard.
* `POST /api/cycles` — Inserts a new period entry when a user logs the start of a period.
* `PATCH /api/cycles` — Updates an existing cycle's `end_date` when a user ends their current period.
* `GET /api/pcod-risk` — Reads historical cycles to analyze cycle length standard deviations and detect PCOD risks.
* `POST /api/predict-cycle` — Reads cycles to run the statistical period prediction engine.
* `GET /api/seed` — Clears and inserts demo period cycles for test users (development mode only).

### Frontend Page Dependencies
* **Dashboard (`/`):** Displays predictions, average cycle length, and period start/end prompts.
* **Track Page (`/track`):** Renders the month-view calendar with color-coded period indicators and predicted windows.
* **Insights Page (`/insights`):** Displays historical trend lines, cycle lengths, and exportable PDF doctor reports.

---

## 2. Table: `daily_logs`

### Why It Exists
The `daily_logs` table stores day-to-day physical and emotional symptoms, mood, and flow intensity. This allows the application to capture micro-level health metrics, which help the AI Assistant provide personalized guidance and let the PCOD Risk Assessment identify symptoms (such as bloating, acne, or fatigue) that recur over time.

### Read Access
* **Read by:** Next.js Serverless API routes (bypassing RLS with the service role key).
* **Audience:** The authenticated user whose Clerk ID matches the `user_id` of the rows.

### Write Access
* **Written by:** Next.js Serverless API routes (bypassing RLS with the service role key).
* **Audience:** The authenticated user (performing upsert operations on symptoms).

### API Dependencies
* `GET /api/log-day` — Fetches logged symptoms for a specific `date` to populate the symptom panel.
* `POST /api/log-day` — Upserts daily symptoms, mood, and flow for a specific date (uses `onConflict: 'user_id,date'`).
* `GET /api/log-day/all` — Retrieves all daily logs to construct insights charts and graphs.
* `GET /api/pcod-risk` — Analyzes logged symptoms over the past 30 days to calculate risk factors.
* `GET /api/seed` — Clears and populates mock daily symptoms for test users (development mode only).

### Frontend Page Dependencies
* **Dashboard (`/`):** Feeds logged state into the daily log panel status.
* **Track Page (`/track`):** Allows selecting a calendar day and updating symptoms in real-time.
* **Insights Page (`/insights`):** Renders charts illustrating symptom frequencies, mood distributions, and flow intensity levels. Includes symptom histories in the downloadable PDF doctor report.
