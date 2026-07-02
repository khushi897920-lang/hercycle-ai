-- HerCycle AI — Database Schema Export (PostgreSQL)
-- Schema-Only Export (No Data)

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tables

-- Cycles table
CREATE TABLE IF NOT EXISTS public.cycles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE,
  cycle_length  INTEGER DEFAULT 28,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Daily logs table
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date       DATE NOT NULL,
  symptoms   TEXT[],
  mood       TEXT,
  flow       TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, date)
);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- No public policies exist. Access is managed solely through backend services 
-- using the service_role bypass key.

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON public.cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id_date ON public.daily_logs(user_id, date);

-- 6. Functions & Triggers
-- (None configured for user data tables)
