-- HerCycle AI — Role-Based Access Control (RBAC) for Teams Schema (Migration 14)

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
