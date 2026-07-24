-- Migration: Add pairing_attempts table for database-based rate limiting
-- Replaces the in-memory Map used for pairing attempt tracking

CREATE TABLE IF NOT EXISTS public.pairing_attempts (
    user_id TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pairing_attempts ENABLE ROW LEVEL SECURITY;