-- Migration: 03_enhance_partner_schema.sql
-- Description: Adds care tips, energy battery permissions, and partner_nudges table for cute love letters.

-- 1. Add permissions for care recommendations and energy meter
ALTER TABLE public.partner_permissions 
ADD COLUMN IF NOT EXISTS show_care_tips BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_energy_battery BOOLEAN DEFAULT true;

-- 2. Create table for partner nudges and cute love letters
CREATE TABLE IF NOT EXISTS public.partner_nudges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    nudge_type TEXT NOT NULL CHECK (nudge_type IN ('hug', 'tea', 'snack', 'water', 'letter')),
    message TEXT,
    sender_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure sender_id column exists if table was created previously
ALTER TABLE public.partner_nudges ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- Index for querying by connection
CREATE INDEX IF NOT EXISTS idx_partner_nudges_conn ON public.partner_nudges(connection_id);

-- Enable RLS
ALTER TABLE public.partner_nudges ENABLE ROW LEVEL SECURITY;
