# PostgreSQL to MongoDB Migration Guide

This document describes how to migrate the HerCycle AI database from PostgreSQL (Supabase) to MongoDB.

---

## 1. Collection Mapping & Schemas

### A. Collection: `cycles`
Maps directly to the SQL `cycles` table.

#### Mongoose Document Schema (JavaScript)
```javascript
const mongoose = require('mongoose');

const CycleSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true // Replaces idx_cycles_user_id
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    default: null
  },
  cycleLength: {
    type: Number,
    default: 28
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Cycle || mongoose.model('Cycle', CycleSchema);
```

#### Example Document
```json
{
  "_id": "60c72b2f9b1d8b2a1c8b4567",
  "userId": "user_3FV2opwmxi914v7Hzb7NHS7nQVN",
  "startDate": "2026-06-22T00:00:00.000Z",
  "endDate": "2026-06-22T00:00:00.000Z",
  "cycleLength": 28,
  "createdAt": "2026-06-22T16:41:19.470Z"
}
```

---

### B. Collection: `daily_logs`
Maps directly to the SQL `daily_logs` table.

#### Mongoose Document Schema (JavaScript)
```javascript
const mongoose = require('mongoose');

const DailyLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  symptoms: {
    type: [String],
    default: []
  },
  mood: {
    type: String,
    default: null
  },
  flow: {
    type: String,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index replaces daily_logs_user_date_unique constraint
DailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.DailyLog || mongoose.model('DailyLog', DailyLogSchema);
```

#### Example Document
```json
{
  "_id": "60c72b2f9b1d8b2a1c8b4568",
  "userId": "user_3FV2opwmxi914v7Hzb7NHS7nQVN",
  "date": "2026-06-22T00:00:00.000Z",
  "symptoms": ["Bloating", "Nausea", "Fatigue", "Headache"],
  "mood": "😐",
  "flow": "f3",
  "updatedAt": "2026-06-22T17:42:27.733Z"
}
```

---

## 2. Required Code Changes
To support MongoDB, you must replace the Supabase JS client calls with Mongoose queries.

### Query Mapping Example: `GET /api/cycles`
* **Old (Supabase):**
  ```javascript
  const { data: cycles } = await supabaseAdmin
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(12);
  ```
* **New (Mongoose/MongoDB):**
  ```javascript
  const Cycle = require('@/models/Cycle');
  const cycles = await Cycle.find({ userId })
    .sort({ startDate: -1 })
    .limit(12)
    .lean();
  ```

### Query Mapping Example: `POST /api/log-day`
* **Old (Supabase):**
  ```javascript
  const { error } = await supabaseAdmin
    .from('daily_logs')
    .upsert(
      { user_id: userId, date, symptoms, mood, flow, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
  ```
* **New (Mongoose/MongoDB):**
  ```javascript
  const DailyLog = require('@/models/DailyLog');
  await DailyLog.findOneAndUpdate(
    { userId, date: new Date(date) },
    { symptoms, mood, flow, updatedAt: new Date() },
    { upsert: true, new: true, runValidators: true }
  );
  ```

---

## 3. What Cannot Be Migrated Directly
1. **Row Level Security (RLS):** MongoDB does not have built-in Row Level Security at the collection level in the same way PostgreSQL does. Security must be entirely managed by backend application code (verifying the logged-in Clerk `userId` matches the document's `userId` before returning it).
2. **Supabase Auto-Generated REST API:** You will no longer be able to use the client-side Supabase client (`@supabase/supabase-js`). You must build full Express/Next.js endpoints for every database action since MongoDB queries cannot be safely run from the client browser.

---

## 4. Advantages & Disadvantages

### Advantages of MongoDB
* **Dynamic Schema:** Symptoms can be structured flexibly as sub-documents without worrying about array limits or strict PostgreSQL column typing.
* **Familiar Javascript Syntax:** Querying and schema definition are written entirely in JavaScript/JSON format.
* **Clerk Friendly:** Native support for string IDs makes mapping Clerk IDs seamless.

### Disadvantages of MongoDB
* **Loss of Relational Integrity:** No PostgreSQL constraints like `UNIQUE` key checks at the engine level without creating custom indexes.
* **Security Overhead:** You lose Supabase's automatic RLS mechanisms, shifting 100% of the data leakage prevention workload to your API endpoint implementations.
