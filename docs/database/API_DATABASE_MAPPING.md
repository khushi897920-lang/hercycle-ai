# API-to-Database Mapping Reference

This document maps all backend API routes in HerCycle AI to their corresponding database tables, methods, columns, and response structures.

---

## 1. `/api/cycles`

### `GET /api/cycles`
* **Table:** `cycles`
* **Method:** `select('*')`
* **Filters:** `.eq('user_id', userId)`, `.order('start_date', { ascending: false })`, `.limit(12)`
* **Database Columns Read:** `id`, `user_id`, `start_date`, `end_date`, `cycle_length`, `created_at`
* **Response Returned:**
  ```json
  {
    "success": true,
    "data": {
      "cycles": [ ... ],
      "nextPeriodDate": "YYYY-MM-DD",
      "confidence": 85,
      "averageCycleLength": 28
    }
  }
  ```

### `POST /api/cycles`
* **Table:** `cycles`
* **Method:** `insert([...])`
* **Database Columns Written:**
  * `user_id` (from Clerk session)
  * `start_date` (from payload)
  * `end_date` (from payload, optional)
  * `cycle_length` (from payload, defaults to 28)
  * `created_at` (server-generated ISO timestamp)
* **Response Returned:**
  ```json
  { "success": true }
  ```

### `PATCH /api/cycles`
* **Table:** `cycles`
* **Method:** `update({ end_date })`
* **Filters:** `.eq('id', id)`, `.eq('user_id', userId)`
* **Database Columns Written:**
  * `end_date` (from payload)
* **Response Returned:**
  ```json
  { "success": true }
  ```

---

## 2. `/api/log-day`

### `GET /api/log-day?date=YYYY-MM-DD`
* **Table:** `daily_logs`
* **Method:** `select('*')`
* **Filters:** `.eq('user_id', userId)`, `.eq('date', date)`, `.maybeSingle()`
* **Database Columns Read:** `id`, `user_id`, `date`, `symptoms`, `mood`, `flow`, `updated_at`
* **Response Returned:**
  ```json
  {
    "success": true,
    "data": {
      "id": "...",
      "user_id": "...",
      "date": "...",
      "symptoms": [...],
      "mood": "...",
      "flow": "...",
      "updated_at": "..."
    } // or null
  }
  ```

### `POST /api/log-day`
* **Table:** `daily_logs`
* **Method:** `upsert({...}, { onConflict: 'user_id,date' })`
* **Database Columns Written/Updated:**
  * `user_id` (from Clerk session)
  * `date` (from payload)
  * `symptoms` (from payload)
  * `mood` (from payload)
  * `flow` (from payload)
  * `updated_at` (server-generated ISO timestamp)
* **Response Returned:**
  ```json
  { "success": true, "message": "Day logged successfully!" }
  ```

---

## 3. `/api/log-day/all`

### `GET /api/log-day/all`
* **Table:** `daily_logs`
* **Method:** `select('*')`
* **Filters:** `.eq('user_id', userId)`, `.order('date', { ascending: false })`
* **Database Columns Read:** `id`, `user_id`, `date`, `symptoms`, `mood`, `flow`, `updated_at`
* **Response Returned:**
  ```json
  {
    "success": true,
    "data": [ ... ]
  }
  ```

---

## 4. `/api/pcod-risk`

### `GET /api/pcod-risk`
* **Tables:** `cycles` and `daily_logs`
* **Method:**
  * Cycles query: `select('*')` filtered by `.eq('user_id', userId)`, ordered by `start_date DESC`, limited to `12`.
  * Logs query: `select('symptoms')` filtered by `.eq('user_id', userId)`, ordered by `date DESC`, limited to `30`.
* **Database Columns Read:**
  * `cycles`: `start_date`, `end_date`, `cycle_length`
  * `daily_logs`: `symptoms`
* **Response Returned:**
  ```json
  {
    "success": true,
    "data": {
      "score": 35,
      "label": "LOW RISK",
      "factors": [ ... ],
      "recommendation": "..."
    }
  }
  ```

---

## 5. `/api/predict-cycle`

### `POST /api/predict-cycle`
* **Table:** `cycles`
* **Method:** `select('*')`
* **Filters:** `.eq('user_id', userId)`, `.order('start_date', { ascending: false })`, `.limit(12)`
* **Database Columns Read:** `id`, `user_id`, `start_date`, `end_date`, `cycle_length`
* **Response Returned:**
  ```json
  {
    "success": true,
    "prediction": {
      "nextPeriodDate": "YYYY-MM-DD",
      "confidence": 80,
      "averageCycleLength": 28
    }
  }
  ```

---

## 6. `/api/seed`

### `GET /api/seed` (Development Only)
* **Tables:** `cycles` and `daily_logs`
* **Methods:**
  * `.from('daily_logs').delete().eq('user_id', USER_ID)`
  * `.from('cycles').delete().eq('user_id', USER_ID)`
  * `.from('cycles').insert(cycleRows)`
  * `.from('daily_logs').upsert(logRows, { onConflict: 'user_id,date' })`
* **Database Columns Written:** All tables/fields for the demo mock user ID.
* **Response Returned:**
  ```json
  {
    "success": true,
    "message": "✅ Seeded 6 cycles and 146 daily logs for demo-user",
    "summary": { ... }
  }
  ```

---

## 7. `/api/test-db`

### `GET /api/test-db`
* **Table:** `cycles`
* **Method:** `select('id')`
* **Filters:** `.limit(1)`
* **Response Returned:**
  ```json
  {
    "success": true,
    "message": "Supabase connection successful!",
    "queryTimeMs": 142,
    "rowCount": 1,
    "diagnostics": {
      "supabaseUrl": "Defined (...)",
      "supabaseAnonKey": "Defined (...)",
      "supabaseServiceRoleKey": "Defined (...)",
      "clerkPublishableKey": "Defined",
      "clerkSecretKey": "Defined (...)",
      "nodeEnv": "development"
    }
  }
  ```
