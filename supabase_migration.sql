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
  allow_ai_analysis BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and update their own profile" 
  ON user_profiles FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

-- 4. Rate Limiter Setup
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  last_request TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION enforce_rate_limit(p_identifier TEXT, p_limit INTEGER, p_interval INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_last_request TIMESTAMPTZ;
  v_allowed BOOLEAN;
BEGIN
  -- Select existing record
  SELECT request_count, last_request INTO v_count, v_last_request
  FROM rate_limits
  WHERE identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Insert new record if it doesn't exist
    INSERT INTO rate_limits (identifier, request_count, last_request)
    VALUES (p_identifier, 1, now());
    v_allowed := true;
  ELSE
    -- If interval has passed, reset count
    IF now() - v_last_request > (p_interval || ' milliseconds')::interval THEN
      UPDATE rate_limits
      SET request_count = 1, last_request = now()
      WHERE identifier = p_identifier;
      v_allowed := true;
    ELSE
      -- Interval hasn't passed, check count
      IF v_count < p_limit THEN
        UPDATE rate_limits
        SET request_count = request_count + 1, last_request = now()
        WHERE identifier = p_identifier;
        v_allowed := true;
      ELSE
        v_allowed := false;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', v_allowed);
END;
$$;
