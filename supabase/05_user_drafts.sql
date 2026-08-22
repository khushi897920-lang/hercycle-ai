-- Migration 05: Create user_drafts table for autosaving blog posts & community updates

CREATE TABLE IF NOT EXISTS public.user_drafts (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  draft_type TEXT DEFAULT 'forum_post',
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category_id TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own drafts
CREATE POLICY "Users can manage their own drafts"
  ON public.user_drafts FOR ALL
  USING ((auth.jwt() ->> 'sub') = user_id);

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_drafts_user ON public.user_drafts(user_id);
