-- Migration Script for End-to-End Encryption (E2EE)

-- 1. Add encrypted columns to `cycles` table
ALTER TABLE cycles 
ADD COLUMN IF NOT EXISTS encrypted_data TEXT;

-- 2. Add encrypted columns to `daily_logs` table
ALTER TABLE daily_logs 
ADD COLUMN IF NOT EXISTS encrypted_data TEXT,
ADD COLUMN IF NOT EXISTS date_hash TEXT;

-- (Optional) Later, once all clients are migrated and old data is encrypted by the client 
-- and re-uploaded, you can drop the old plaintext columns:
-- ALTER TABLE cycles DROP COLUMN start_date, DROP COLUMN end_date, DROP COLUMN cycle_length;
-- ALTER TABLE daily_logs DROP COLUMN date, DROP COLUMN symptoms, DROP COLUMN mood, DROP COLUMN flow, DROP COLUMN cervical_discharge;

-- 3. Create user_profiles table for Health Profile context
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY, -- Maps to Clerk User ID
  age INTEGER CHECK (age > 0 AND age < 120),
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  known_conditions TEXT[] DEFAULT '{}',
  cycle_goal TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and update their own profile" 
  ON user_profiles FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);
