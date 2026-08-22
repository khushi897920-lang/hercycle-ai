-- Migration 07: Create oauth_providers and auth_logs tables for OAuth Provider Management Dashboard

CREATE TABLE IF NOT EXISTS public.oauth_providers (
  id TEXT PRIMARY KEY, -- e.g. 'google', 'github', 'apple', 'facebook'
  name TEXT NOT NULL,
  client_id TEXT DEFAULT '',
  client_secret TEXT DEFAULT '',
  is_enabled BOOLEAN DEFAULT false,
  scopes TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event TEXT NOT NULL, -- e.g., 'CALLBACK_SUCCESS', 'CALLBACK_ERROR', 'PROVIDER_ENABLED', 'PROVIDER_DISABLED', 'CREDENTIALS_UPDATED'
  status TEXT DEFAULT 'info', -- 'success', 'error', 'warning', 'info'
  message TEXT DEFAULT '',
  user_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage oauth providers"
  ON public.oauth_providers FOR ALL USING (true);

CREATE POLICY "Admins can view and write auth logs"
  ON public.auth_logs FOR ALL USING (true);

-- Seed default providers
INSERT INTO public.oauth_providers (id, name, is_enabled, scopes)
VALUES 
  ('google', 'Google', false, ARRAY['email', 'profile']),
  ('github', 'GitHub', false, ARRAY['user:email', 'read:user']),
  ('apple', 'Apple', false, ARRAY['name', 'email']),
  ('facebook', 'Facebook', false, ARRAY['email', 'public_profile'])
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_logs_provider ON public.auth_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON public.auth_logs(status);
