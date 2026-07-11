-- Migration: 02_add_partner_schema.sql
-- Description: Adds tables for the Partner Cycle Tracking feature.

-- 1. Table: partner_connections
CREATE TABLE public.partner_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_user_id TEXT NOT NULL,
    partner_user_id TEXT,
    pairing_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by primary user or partner user
CREATE INDEX idx_partner_conn_primary ON public.partner_connections(primary_user_id);
CREATE INDEX idx_partner_conn_partner ON public.partner_connections(partner_user_id);

-- 2. Table: partner_permissions
CREATE TABLE public.partner_permissions (
    connection_id UUID PRIMARY KEY REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    show_mood BOOLEAN DEFAULT false,
    show_symptoms BOOLEAN DEFAULT false,
    show_fertile_window BOOLEAN DEFAULT true,
    show_notes BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS to block all public access (since API routes use service role key)
ALTER TABLE public.partner_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_permissions ENABLE ROW LEVEL SECURITY;
