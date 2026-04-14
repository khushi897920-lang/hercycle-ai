-- ============================================
-- HerCycle AI - Supabase Database Schema
-- ============================================
-- This schema creates tables for menstrual cycle tracking,
-- daily logs, and user data for the HerCycle AI platform.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (Optional - for Supabase Auth)
-- ============================================
-- Note: Supabase Auth automatically creates an auth.users table
-- This table extends it with additional user profile data

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can read own data" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = auth_user_id);

-- Users can update their own data
CREATE POLICY "Users can update own data" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = auth_user_id);

-- ============================================
-- CYCLES TABLE
-- ============================================
-- Stores menstrual cycle records with start/end dates

CREATE TABLE IF NOT EXISTS public.cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- For MVP, using simple text ID. Change to UUID for production auth
  start_date DATE NOT NULL,
  end_date DATE,
  cycle_length INTEGER GENERATED ALWAYS AS (end_date - start_date) STORED,
  symptoms TEXT[], -- Array of symptoms
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON public.cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_cycles_start_date ON public.cycles(start_date DESC);

-- Add RLS
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

-- For MVP: Allow all operations (since we're using demo user ID)
CREATE POLICY "Allow all for MVP" 
  ON public.cycles 
  FOR ALL 
  USING (true);

-- For Production: Uncomment these and comment out the above policy
-- CREATE POLICY "Users can read own cycles" 
--   ON public.cycles 
--   FOR SELECT 
--   USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can insert own cycles" 
--   ON public.cycles 
--   FOR INSERT 
--   WITH CHECK (auth.uid()::text = user_id);

-- CREATE POLICY "Users can update own cycles" 
--   ON public.cycles 
--   FOR UPDATE 
--   USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can delete own cycles" 
--   ON public.cycles 
--   FOR DELETE 
--   USING (auth.uid()::text = user_id);

-- ============================================
-- DAILY LOGS TABLE
-- ============================================
-- Tracks daily symptoms, mood, and flow intensity

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  symptoms TEXT[], -- Array: ["Cramps", "Headache", "Bloating", "Fatigue", "Acne", "Nausea"]
  mood TEXT, -- Emoji or text: "😊", "😐", "😢", "😡"
  flow TEXT, -- "light", "medium", "heavy", or null
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date) -- One log per user per day
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON public.daily_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, date);

-- Add RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- For MVP: Allow all operations
CREATE POLICY "Allow all for MVP" 
  ON public.daily_logs 
  FOR ALL 
  USING (true);

-- For Production: Uncomment these
-- CREATE POLICY "Users can read own logs" 
--   ON public.daily_logs 
--   FOR SELECT 
--   USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can insert own logs" 
--   ON public.daily_logs 
--   FOR INSERT 
--   WITH CHECK (auth.uid()::text = user_id);

-- CREATE POLICY "Users can update own logs" 
--   ON public.daily_logs 
--   FOR UPDATE 
--   USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can delete own logs" 
--   ON public.daily_logs 
--   FOR DELETE 
--   USING (auth.uid()::text = user_id);

-- ============================================
-- CHAT HISTORY TABLE (Optional)
-- ============================================
-- Stores AI chatbot conversation history

CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  role TEXT NOT NULL, -- "user" or "ai"
  language TEXT DEFAULT 'EN', -- "EN" or "हि"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(created_at DESC);

-- Add RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- For MVP: Allow all operations
CREATE POLICY "Allow all for MVP" 
  ON public.chat_history 
  FOR ALL 
  USING (true);

-- ============================================
-- PREDICTIONS TABLE (Optional - for caching)
-- ============================================
-- Stores cycle predictions to avoid recalculating

CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  next_period_date DATE NOT NULL,
  ovulation_start DATE,
  ovulation_end DATE,
  confidence_score NUMERIC(5,2), -- 0.00 to 100.00
  average_cycle_length INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One prediction per user (latest)
);

-- Add RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for MVP" 
  ON public.predictions 
  FOR ALL 
  USING (true);

-- ============================================
-- PCOD RISK ASSESSMENTS TABLE (Optional)
-- ============================================
-- Stores historical PCOD risk scores

CREATE TABLE IF NOT EXISTS public.pcod_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL, -- 0.00 to 100.00
  risk_label TEXT NOT NULL, -- "LOW RISK", "MEDIUM RISK", "HIGH RISK"
  risk_factors TEXT[], -- Array of contributing factors
  recommendation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_pcod_assessments_user_id ON public.pcod_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_pcod_assessments_created_at ON public.pcod_assessments(created_at DESC);

-- Add RLS
ALTER TABLE public.pcod_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for MVP" 
  ON public.pcod_assessments 
  FOR ALL 
  USING (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cycles_updated_at
  BEFORE UPDATE ON public.cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample cycle data for demo user
INSERT INTO public.cycles (user_id, start_date, end_date, symptoms) VALUES
  ('demo-user-001', '2024-12-05', '2024-12-09', ARRAY['Cramps', 'Fatigue']),
  ('demo-user-001', '2025-01-02', '2025-01-06', ARRAY['Headache', 'Bloating'])
ON CONFLICT DO NOTHING;

-- Insert sample daily log
INSERT INTO public.daily_logs (user_id, date, symptoms, mood, flow) VALUES
  ('demo-user-001', '2025-01-15', ARRAY['Cramps'], '😊', 'medium')
ON CONFLICT (user_id, date) DO NOTHING;

-- ============================================
-- VIEWS (Optional - for analytics)
-- ============================================

-- View: User cycle statistics
CREATE OR REPLACE VIEW public.user_cycle_stats AS
SELECT 
  user_id,
  COUNT(*) as total_cycles,
  AVG(cycle_length) as avg_cycle_length,
  STDDEV(cycle_length) as cycle_length_variance,
  MAX(start_date) as last_period_date
FROM public.cycles
WHERE end_date IS NOT NULL
GROUP BY user_id;

-- View: Most common symptoms
CREATE OR REPLACE VIEW public.common_symptoms AS
SELECT 
  user_id,
  UNNEST(symptoms) as symptom,
  COUNT(*) as frequency
FROM public.daily_logs
WHERE symptoms IS NOT NULL
GROUP BY user_id, symptom
ORDER BY frequency DESC;

-- ============================================
-- GRANTS (for Supabase service role)
-- ============================================

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- NOTES
-- ============================================
-- 1. For production, replace TEXT user_id with UUID and link to auth.users
-- 2. Enable Supabase Auth and update RLS policies
-- 3. Add data retention policies (e.g., keep chat history for 90 days)
-- 4. Consider partitioning large tables by date for performance
-- 5. Add backup strategy for sensitive health data
-- 6. Implement encryption at rest for symptoms/notes fields
-- 7. Add audit logging for compliance (HIPAA/GDPR)

-- Run this schema in your Supabase SQL editor
-- Then update your .env with the Supabase URL and anon key
