-- Add composite B-tree indexes to optimize user filtering and descending date sorting
CREATE INDEX IF NOT EXISTS idx_cycles_user_start_date ON cycles(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_user_recorded ON weight_entries(user_id, recorded_date DESC);
