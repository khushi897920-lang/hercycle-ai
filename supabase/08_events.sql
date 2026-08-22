-- Migration 08: Create events table for Multi-Language Calendar Integration

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  recurrence_rule TEXT DEFAULT 'none', -- 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  category TEXT DEFAULT 'reminder', -- 'reminder' | 'habit' | 'donation' | 'health'
  time_zone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own calendar events
CREATE POLICY "Users can manage their own calendar events"
  ON public.events FOR ALL
  USING ((auth.jwt() ->> 'sub') = user_id);

-- Performance Index on user_id and start_time
CREATE INDEX IF NOT EXISTS idx_events_user_start ON public.events(user_id, start_time DESC);
