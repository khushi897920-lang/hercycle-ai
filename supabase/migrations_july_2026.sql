-- HerCycle AI — Database Migration Script (July 2026)
-- Run this in your Supabase SQL Editor to add the missing RPC functions, rate limiting tables, and foreign keys.

-- 1. Create public.rate_limits table for the serverless rate limiter
CREATE TABLE IF NOT EXISTS public.rate_limits (
    identifier TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Create the enforce_rate_limit RPC function
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
    p_identifier TEXT,
    p_limit INTEGER,
    p_interval INTEGER -- in milliseconds
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

    -- Clean up old rate limits occasionally or just in-line
    DELETE FROM public.rate_limits WHERE reset_at < v_now;

    -- Upsert the counter
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

-- 3. Create the handle_vote RPC function for atomic forum voting
CREATE OR REPLACE FUNCTION public.handle_vote(
    p_user_id TEXT,
    p_item_type TEXT,
    p_item_id UUID,
    p_vote_value INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_vote_id UUID;
    v_existing_value INTEGER;
    v_action TEXT;
    v_current_vote INTEGER;
    v_table_name TEXT;
    v_net_change INTEGER;
BEGIN
    -- Validate item type
    IF p_item_type = 'post' THEN
        v_table_name := 'forum_posts';
    ELSIF p_item_type = 'comment' THEN
        v_table_name := 'forum_comments';
    ELSE
        RAISE EXCEPTION 'Invalid item type: %', p_item_type;
    END IF;

    -- Check if vote exists
    SELECT id, vote_value INTO v_existing_vote_id, v_existing_value
    FROM public.forum_votes
    WHERE user_id = p_user_id AND item_type = p_item_type AND item_id = p_item_id;

    IF v_existing_vote_id IS NULL THEN
        -- New vote
        INSERT INTO public.forum_votes (user_id, item_type, item_id, vote_value)
        VALUES (p_user_id, p_item_type, p_item_id, p_vote_value);

        -- Update the upvotes counter
        v_net_change := p_vote_value;
        v_action := 'added';
        v_current_vote := p_vote_value;
    ELSE
        -- Existing vote
        IF v_existing_value = p_vote_value THEN
            -- Toggle vote off (remove)
            DELETE FROM public.forum_votes WHERE id = v_existing_vote_id;

            v_net_change := -p_vote_value;
            v_action := 'removed';
            v_current_vote := 0;
        ELSE
            -- Change vote value (e.g. 1 to -1 or -1 to 1)
            UPDATE public.forum_votes
            SET vote_value = p_vote_value
            WHERE id = v_existing_vote_id;

            v_net_change := p_vote_value * 2;
            v_action := 'changed';
            v_current_vote := p_vote_value;
        END IF;
    END IF;

    -- Update counts in the corresponding table dynamically
    IF v_table_name = 'forum_posts' THEN
        UPDATE public.forum_posts
        SET upvotes = COALESCE(upvotes, 0) + v_net_change
        WHERE id = p_item_id;
    ELSIF v_table_name = 'forum_comments' THEN
        UPDATE public.forum_comments
        SET upvotes = COALESCE(upvotes, 0) + v_net_change
        WHERE id = p_item_id;
    END IF;

    RETURN jsonb_build_object(
        'action', v_action,
        'current_vote', v_current_vote
    );
END;
$$;

-- 4. Add cascading delete foreign key constraint to weight_entries referencing users
ALTER TABLE public.weight_entries
  DROP CONSTRAINT IF EXISTS weight_entries_user_id_fkey;

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;

-- 5. Add cascading delete foreign key constraints to partner_connections referencing users
ALTER TABLE public.partner_connections
  DROP CONSTRAINT IF EXISTS partner_connections_primary_user_id_fkey,
  DROP CONSTRAINT IF EXISTS partner_connections_partner_user_id_fkey;

ALTER TABLE public.partner_connections
  ADD CONSTRAINT partner_connections_primary_user_id_fkey
  FOREIGN KEY (primary_user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.partner_connections
  ADD CONSTRAINT partner_connections_partner_user_id_fkey
  FOREIGN KEY (partner_user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;
