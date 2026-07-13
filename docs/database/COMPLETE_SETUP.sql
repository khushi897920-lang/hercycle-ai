-- HerCycle AI — Consolidated Complete Database Schema Setup & Migration
-- Run this in your Supabase SQL Editor to initialize all tables, indexes, RLS, and seed data.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create public.users table (mirrors Clerk authenticated users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create public.cycles table (Period cycles tracker)
CREATE TABLE IF NOT EXISTS public.cycles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE,
  cycle_length    INTEGER DEFAULT 28,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Create public.daily_logs table (Daily symptoms, mood, flow tracker)
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL,
  date            DATE NOT NULL,
  symptoms        TEXT[],
  mood            TEXT,
  flow            TEXT,
  cervical_discharge TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, date)
);

-- 5. Create public.weight_entries table (Weight tracker)
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL,
  recorded_date   DATE NOT NULL,
  weight_kg       NUMERIC(5,2) NOT NULL CHECK (weight_kg >= 20 AND weight_kg <= 350),
  waist_cm        NUMERIC(5,2) CHECK (waist_cm IS NULL OR (waist_cm >= 30 AND waist_cm <= 250)),
  height_cm       NUMERIC(5,2) NOT NULL CHECK (height_cm >= 100 AND height_cm <= 250),
  bmi             NUMERIC(5,2) NOT NULL CHECK (bmi >= 5 AND bmi <= 100),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT weight_entries_user_date_unique UNIQUE (user_id, recorded_date)
);

-- 6. Create public.partner_connections table (Partner sharing connection status)
CREATE TABLE IF NOT EXISTS public.partner_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    partner_user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    pairing_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create public.partner_permissions table (Partner access controls)
CREATE TABLE IF NOT EXISTS public.partner_permissions (
    connection_id UUID PRIMARY KEY REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    show_mood BOOLEAN DEFAULT false,
    show_symptoms BOOLEAN DEFAULT false,
    show_fertile_window BOOLEAN DEFAULT true,
    show_notes BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create public.forum_categories table (Community discussion channels)
CREATE TABLE IF NOT EXISTS public.forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create public.forum_posts table (Community posts)
CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.forum_categories(id) ON DELETE CASCADE,
    author_alias TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create public.forum_comments table (Community comments)
CREATE TABLE IF NOT EXISTS public.forum_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    author_alias TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create public.forum_votes table (Upvotes/Downvotes tracking)
CREATE TABLE IF NOT EXISTS public.forum_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Hashed clerk ID
    item_type TEXT NOT NULL CHECK (item_type IN ('post', 'comment')),
    item_id UUID NOT NULL,
    vote_value INTEGER NOT NULL CHECK (vote_value IN (1, -1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_type, item_id)
);

-- 12. Add Cascading Delete Foreign Key Constraints
ALTER TABLE public.cycles DROP CONSTRAINT IF EXISTS cycles_user_id_fkey;
ALTER TABLE public.cycles ADD CONSTRAINT cycles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.daily_logs DROP CONSTRAINT IF EXISTS daily_logs_user_id_fkey;
ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 13. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

-- 14. Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON public.cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id_date ON public.daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON public.weight_entries(user_id, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_partner_conn_primary ON public.partner_connections(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_conn_partner ON public.partner_connections(partner_user_id);

-- 15. Setup Supabase Realtime for forum updates
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_comments;

-- 16. Seed Default Forum Categories
INSERT INTO public.forum_categories (name, slug, description)
VALUES 
    ('PCOD Advice', 'pcod-advice', 'Share tips and ask questions about managing PCOD.'),
    ('Cycle Tracking', 'cycle-tracking', 'Discuss period tracking, ovulation, and cycle irregularities.'),
    ('Mental Health', 'mental-health', 'A safe space to talk about emotional well-being and stress.'),
    ('General Discussion', 'general-discussion', 'Talk about anything else related to women''s health.')
ON CONFLICT (slug) DO NOTHING;



-- 17. RLS Policies for forum tables
-- forum_categories: publicly readable by anyone (anon + authenticated)
DROP POLICY IF EXISTS "forum_categories_public_read" ON public.forum_categories;
CREATE POLICY "forum_categories_public_read"
  ON public.forum_categories FOR SELECT
  USING (true);

-- forum_posts: publicly readable
DROP POLICY IF EXISTS "forum_posts_public_read" ON public.forum_posts;
CREATE POLICY "forum_posts_public_read"
  ON public.forum_posts FOR SELECT
  USING (true);

-- forum_comments: publicly readable
DROP POLICY IF EXISTS "forum_comments_public_read" ON public.forum_comments;
CREATE POLICY "forum_comments_public_read"
  ON public.forum_comments FOR SELECT
  USING (true);

-- forum_votes: publicly readable
DROP POLICY IF EXISTS "forum_votes_public_read" ON public.forum_votes;
CREATE POLICY "forum_votes_public_read"
  ON public.forum_votes FOR SELECT
  USING (true);


