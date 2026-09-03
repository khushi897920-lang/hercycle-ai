-- HerCycle AI — Master Production Database Setup Script
-- Run this script in your Supabase SQL Editor to set up all tables, indexes, RLS policies, and RPC functions.

-- ========================================================
-- 1. Rate Limiting Table & Stored Procedures
-- ========================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    identifier TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Define the enforce_rate_limit RPC function
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
    p_identifier TEXT,
    p_limit INTEGER,
    p_interval INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_record RECORD;
    v_allowed BOOLEAN;
    v_interval_dur INTERVAL;
BEGIN
    v_interval_dur := (p_interval || ' milliseconds')::interval;
    DELETE FROM public.rate_limits WHERE reset_at < v_now;

    INSERT INTO public.rate_limits (identifier, count, reset_at)
    VALUES (p_identifier, 1, v_now + v_interval_dur)
    ON CONFLICT (identifier) DO UPDATE
    SET count = CASE 
                  WHEN public.rate_limits.reset_at < v_now THEN 1
                  ELSE public.rate_limits.count + 1
                END,
        reset_at = CASE 
                     WHEN public.rate_limits.reset_at < v_now THEN v_now + v_interval_dur
                     ELSE public.rate_limits.reset_at
                   END
    RETURNING count, reset_at INTO v_record;

    IF v_record.count <= p_limit THEN
        v_allowed := TRUE;
    ELSE
        v_allowed := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'count', v_record.count,
        'reset_at', v_record.reset_at
    );
END;
$$;


-- ========================================================
-- 2. Partner Connection & Companion Tables
-- ========================================================

CREATE TABLE IF NOT EXISTS public.pairing_attempts (
    user_id TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pairing_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partner_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_user_id TEXT NOT NULL,
    partner_user_id TEXT,
    pairing_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_conn_primary ON public.partner_connections(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_conn_partner ON public.partner_connections(partner_user_id);
ALTER TABLE public.partner_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partner_permissions (
    connection_id UUID PRIMARY KEY REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    show_mood BOOLEAN DEFAULT false,
    show_symptoms BOOLEAN DEFAULT false,
    show_fertile_window BOOLEAN DEFAULT true,
    show_notes BOOLEAN DEFAULT false,
    show_care_tips BOOLEAN DEFAULT true,
    show_energy_battery BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_permissions ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 3. Partner Nudges, Quests & Care Tracker
-- ========================================================

CREATE TABLE IF NOT EXISTS public.partner_nudges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    nudge_type TEXT NOT NULL,
    message TEXT,
    sender_id TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nudges_read ON public.partner_nudges(connection_id, read_at);
ALTER TABLE public.partner_nudges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partner_quests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    quest_title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quests_conn ON public.partner_quests(connection_id);
ALTER TABLE public.partner_quests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partner_vibes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    vibe_type TEXT NOT NULL,
    vibe_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vibes_conn ON public.partner_vibes(connection_id);
ALTER TABLE public.partner_vibes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    subscription JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.user_push_subscriptions(user_id);
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;


-- ========================================================
-- 4. Weight Tracker & BMI metrics
-- ========================================================

CREATE TABLE IF NOT EXISTS public.weight_entries (
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

CREATE INDEX IF NOT EXISTS weight_entries_user_date_idx ON public.weight_entries(user_id, recorded_date DESC);
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;


-- ========================================================
-- 5. Daily Challenges & Badges
-- ========================================================

CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('water', 'stretch', 'mood', 'sleep', 'iron')),
    progress_value INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date, challenge_type)
);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_date ON public.challenge_progress(user_id, date);
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    badge_key TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Foreign Key CASCADE Rules for Dependent Health Tables
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.cycles DROP CONSTRAINT IF EXISTS cycles_user_id_fkey;
ALTER TABLE public.cycles ADD CONSTRAINT cycles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.daily_logs DROP CONSTRAINT IF EXISTS daily_logs_user_id_fkey;
ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.weight_entries DROP CONSTRAINT IF EXISTS weight_entries_user_id_fkey;
ALTER TABLE public.weight_entries ADD CONSTRAINT weight_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.challenge_progress DROP CONSTRAINT IF EXISTS challenge_progress_user_id_fkey;
ALTER TABLE public.challenge_progress ADD CONSTRAINT challenge_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_push_subscriptions DROP CONSTRAINT IF EXISTS user_push_subscriptions_user_id_fkey;
ALTER TABLE public.user_push_subscriptions ADD CONSTRAINT user_push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.pairing_attempts DROP CONSTRAINT IF EXISTS pairing_attempts_user_id_fkey;
ALTER TABLE public.pairing_attempts ADD CONSTRAINT pairing_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ========================================================
-- 6. Dataset Versioning & Lineage Tracking
-- ========================================================

CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version_hash TEXT UNIQUE NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    preprocessing_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datasets_name_version ON public.datasets(name, version_hash);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dataset_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    dataset_version_hash TEXT NOT NULL,
    preprocessing_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_lineage_model ON public.dataset_lineage(model_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_hash ON public.dataset_lineage(dataset_version_hash);
ALTER TABLE public.dataset_lineage ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 7. Scheduled Hyper-Parameter Sweeps
-- ========================================================

CREATE TABLE IF NOT EXISTS public.sweeps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    sweep_type TEXT NOT NULL CHECK (sweep_type IN ('grid', 'random')),
    cron_expression TEXT NOT NULL,
    hyperparameter_space JSONB NOT NULL DEFAULT '{}'::jsonb,
    max_trials INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'paused', 'failed')),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ NOT NULL,
    best_trial JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sweeps_model ON public.sweeps(model_id);
CREATE INDEX IF NOT EXISTS idx_sweeps_next_run ON public.sweeps(next_run_at, status);
ALTER TABLE public.sweeps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sweep_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_id UUID REFERENCES public.sweeps(id) ON DELETE CASCADE,
    trial_index INTEGER NOT NULL,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    accuracy NUMERIC(5,4) NOT NULL,
    loss NUMERIC(6,4) NOT NULL,
    val_loss NUMERIC(6,4),
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sweep_trials_sweep ON public.sweep_trials(sweep_id);
ALTER TABLE public.sweep_trials ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 8. Role-Based Access Control (RBAC) for Teams
-- ========================================================

CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_slug ON public.teams(slug);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'runner', 'editor', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    invited_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON public.team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

