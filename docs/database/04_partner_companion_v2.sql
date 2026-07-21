-- Migration: 04_partner_companion_v2.sql
-- Description: Adds tables for Partner Care Quests, Her Comfort Vibe Check-in, read_at column for Read Receipts, and user_push_subscriptions for Server Push.

-- 1. Ensure sender_id and read_at columns exist on partner_nudges for Read Receipts
ALTER TABLE public.partner_nudges ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE public.partner_nudges ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Table for Partner Care Quests
CREATE TABLE IF NOT EXISTS public.partner_quests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    quest_title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table for Her Comfort Vibe Check-in
CREATE TABLE IF NOT EXISTS public.partner_vibes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES public.partner_connections(id) ON DELETE CASCADE,
    vibe_type TEXT NOT NULL,
    vibe_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Table for Web Push & Device Push Subscriptions (WhatsApp / Instagram style background alerts)
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    subscription JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for zero-latency queries
CREATE INDEX IF NOT EXISTS idx_quests_conn ON public.partner_quests(connection_id);
CREATE INDEX IF NOT EXISTS idx_vibes_conn ON public.partner_vibes(connection_id);
CREATE INDEX IF NOT EXISTS idx_nudges_read ON public.partner_nudges(connection_id, read_at);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.user_push_subscriptions(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.partner_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_vibes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;
