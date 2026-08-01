-- challenge_progress: tracks daily progress per user per challenge type
CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('water', 'stretch', 'mood')),
    progress_value INTEGER DEFAULT 0,   -- ml for water, seconds for stretch, 1/0 for mood
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date, challenge_type)
);

-- user_badges: earned badges, one row per badge per user
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_date
    ON public.challenge_progress(user_id, date);