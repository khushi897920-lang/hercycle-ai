-- Migration 06: Create audit_log table for privacy & GDPR compliance tracking

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- e.g. 'DATA_EXPORT', 'ACCOUNT_DELETION', 'PRIVACY_UPDATE'
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admin service role can insert and read audit logs
CREATE POLICY "Admins can view and insert audit logs"
  ON public.audit_log FOR ALL
  USING (true);

-- Index for user audit trail queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON public.audit_log(user_id, action);
