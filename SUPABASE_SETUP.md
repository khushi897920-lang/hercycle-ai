# 🗄️ Supabase Setup Guide for HerCycle AI

This guide will help you set up the Supabase database for HerCycle AI in **5 minutes**.

---

## 📋 Prerequisites

1. A Supabase account (free tier works!)
2. Your Supabase project URL and anon key (already in `.env`)

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: **bkjqlpwymaucoyarnzna**
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### Step 2: Run the Schema

1. Copy the entire contents of `supabase_schema.sql`
2. Paste into the SQL Editor
3. Click **"Run"** button (or press Ctrl+Enter)
4. Wait for success message: ✅ "Success. No rows returned"

### Step 3: Verify Tables

1. Click **"Table Editor"** in left sidebar
2. You should see these tables:
   - ✅ `cycles`
   - ✅ `daily_logs`
   - ✅ `chat_history`
   - ✅ `predictions`
   - ✅ `pcod_assessments`
   - ✅ `users`

**That's it! Your database is ready! 🎉**

---

## 🧪 Test the Connection

### Test API Endpoints

Open your browser's console on https://cycle-predict-3.preview.emergentagent.com and run:

```javascript
// Test cycle data fetch
fetch('/api/cycles')
  .then(r => r.json())
  .then(data => console.log('Cycles:', data))

// Test PCOD risk
fetch('/api/pcod-risk')
  .then(r => r.json())
  .then(data => console.log('PCOD Risk:', data))

// Test logging a day
fetch('/api/log-day', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    date: '2025-01-15',
    symptoms: ['Cramps', 'Fatigue'],
    mood: '😊',
    flow: 'medium'
  })
}).then(r => r.json()).then(data => console.log('Log saved:', data))
```

If everything works, you should see:
- ✅ No more "Could not find table" errors in logs
- ✅ Data being saved to Supabase
- ✅ Real cycle predictions based on your data

---

## 📊 Understanding the Schema

### Table: `cycles`
Stores menstrual cycle records.

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - User identifier
- `start_date` (DATE) - Period start date
- `end_date` (DATE) - Period end date (nullable)
- `cycle_length` (INT) - Auto-calculated from dates
- `symptoms` (TEXT[]) - Array of symptoms
- `notes` (TEXT) - Additional notes
- `created_at`, `updated_at` - Timestamps

**Usage**: Track historical cycles for prediction algorithm.

---

### Table: `daily_logs`
Daily tracking of symptoms, mood, and flow.

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - User identifier
- `date` (DATE) - Log date (unique per user)
- `symptoms` (TEXT[]) - Selected symptoms
- `mood` (TEXT) - Mood emoji
- `flow` (TEXT) - "light", "medium", "heavy"
- `notes` (TEXT) - Optional notes
- `created_at`, `updated_at` - Timestamps

**Usage**: Daily logging feature, symptom analysis for PCOD risk.

---

### Table: `chat_history`
AI chatbot conversation history.

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - User identifier
- `message` (TEXT) - Chat message
- `role` (TEXT) - "user" or "ai"
- `language` (TEXT) - "EN" or "हि"
- `created_at` - Timestamp

**Usage**: Store chat history for context-aware responses.

---

### Table: `predictions`
Cached cycle predictions.

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - User identifier (unique)
- `next_period_date` (DATE) - Predicted date
- `ovulation_start`, `ovulation_end` (DATE) - Ovulation window
- `confidence_score` (NUMERIC) - 0-100
- `average_cycle_length` (INT) - Average cycle length
- `created_at` - Timestamp

**Usage**: Cache predictions to avoid recalculating on every page load.

---

### Table: `pcod_assessments`
Historical PCOD risk assessments.

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - User identifier
- `risk_score` (NUMERIC) - 0-100
- `risk_label` (TEXT) - "LOW RISK", "MEDIUM RISK", "HIGH RISK"
- `risk_factors` (TEXT[]) - Contributing factors
- `recommendation` (TEXT) - Health advice
- `created_at` - Timestamp

**Usage**: Track risk score over time, show trends.

---

## 🔐 Security (Row Level Security)

### Current Setup (MVP)
For the MVP, all tables have **open access** (policy: "Allow all for MVP").

This means:
- ✅ Anyone can read/write data
- ⚠️ **Not production-ready** (but fine for hackathon demo)

### Production Setup (Future)

When adding user authentication:

1. **Enable Supabase Auth** in your project
2. **Uncomment** the production RLS policies in `supabase_schema.sql`
3. **Replace** `user_id TEXT` with `user_id UUID REFERENCES auth.users(id)`

Production policies ensure:
- ✅ Users can only see their own data
- ✅ Users can't access other users' cycles/logs
- ✅ Data is protected at database level

---

## 🎯 Sample Data

The schema includes sample data for testing:

### Sample Cycle
```sql
user_id: 'demo-user-001'
start_date: '2024-12-05'
end_date: '2024-12-09'
symptoms: ['Cramps', 'Fatigue']
```

### Sample Daily Log
```sql
user_id: 'demo-user-001'
date: '2025-01-15'
symptoms: ['Cramps']
mood: '😊'
flow: 'medium'
```

You can view this data in **Table Editor** after running the schema.

---

## 📈 Database Views

The schema includes helpful views for analytics:

### `user_cycle_stats`
Aggregated cycle statistics per user.

**Columns**:
- `user_id`
- `total_cycles` - Count of logged cycles
- `avg_cycle_length` - Average cycle length
- `cycle_length_variance` - Standard deviation
- `last_period_date` - Most recent period

**Usage**:
```sql
SELECT * FROM user_cycle_stats WHERE user_id = 'demo-user-001';
```

---

### `common_symptoms`
Most frequently logged symptoms.

**Columns**:
- `user_id`
- `symptom` - Symptom name
- `frequency` - Count

**Usage**:
```sql
SELECT symptom, frequency 
FROM common_symptoms 
WHERE user_id = 'demo-user-001'
ORDER BY frequency DESC
LIMIT 5;
```

---

## 🛠️ Troubleshooting

### Error: "Could not find table in schema cache"

**Cause**: Tables not created yet.

**Fix**:
1. Run `supabase_schema.sql` in SQL Editor
2. Refresh your app
3. Check Table Editor to confirm tables exist

---

### Error: "Permission denied for table"

**Cause**: RLS policy blocking access.

**Fix**:
1. Check if you're using the correct `user_id`
2. For MVP, ensure "Allow all for MVP" policy exists
3. For production, ensure user is authenticated

---

### Error: "Duplicate key value violates unique constraint"

**Cause**: Trying to insert duplicate data (e.g., same user_id in predictions table).

**Fix**:
1. Use `ON CONFLICT` in your SQL
2. Update existing row instead of inserting
3. Check unique constraints in schema

---

## 📱 API Integration

Once tables are set up, all API endpoints will work:

### Working Endpoints
- ✅ `GET /api/cycles` - No more errors, reads from `cycles` table
- ✅ `GET /api/pcod-risk` - Analyzes `cycles` + `daily_logs`
- ✅ `POST /api/log-day` - Writes to `daily_logs` table
- ✅ `POST /api/chat` - Can optionally write to `chat_history`

### Logs to Monitor
Check backend logs (`/var/log/supervisor/nextjs.out.log`):

**Before setup**:
```
Supabase error: Could not find table 'public.cycles'
```

**After setup**:
```
✅ No errors - data flowing smoothly!
```

---

## 🎓 Next Steps

### For Hackathon Demo
1. ✅ Run the schema
2. ✅ Test all features in the UI
3. ✅ Log some sample data
4. ✅ Show real predictions based on your data

### For Production
1. Enable Supabase Auth
2. Update RLS policies
3. Change `user_id` from TEXT to UUID
4. Add data encryption
5. Set up automated backups
6. Add monitoring and alerts

---

## 📞 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **SQL Reference**: https://www.postgresql.org/docs/
- **HerCycle AI Docs**: See `README.md`

---

**That's it! Your database is production-ready! 🚀**
