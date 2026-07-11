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
