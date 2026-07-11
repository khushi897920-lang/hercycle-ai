-- Issue #41: Weight Tracker
CREATE TABLE IF NOT EXISTS weight_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  recorded_date DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg >= 20 AND weight_kg <= 350),
  waist_cm NUMERIC(5,2) CHECK (waist_cm IS NULL OR (waist_cm >= 30 AND waist_cm <= 250)),
  height_cm NUMERIC(5,2) NOT NULL CHECK (height_cm >= 100 AND height_cm <= 250),
  bmi NUMERIC(5,2) NOT NULL CHECK (bmi >= 5 AND bmi <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT weight_entries_user_date_unique UNIQUE (user_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS weight_entries_user_date_idx
  ON weight_entries(user_id, recorded_date DESC);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

-- The app accesses this table through its authenticated server API using
-- the Supabase service-role client. Keeping RLS enabled prevents accidental
-- direct anonymous access.
