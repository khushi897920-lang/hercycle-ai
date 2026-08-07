-- Migration: give user_push_subscriptions the unique key its writer already assumes
--
-- lib/actions/push.js has always written subscriptions with:
--
--     .upsert([{ user_id, subscription, updated_at }], { onConflict: 'user_id' })
--
-- but the table was created with only a plain index on user_id:
--
--     CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.user_push_subscriptions(user_id);
--
-- PostgreSQL answers ON CONFLICT against a non-unique column with
--
--     42P10: there is no unique or exclusion constraint matching the
--            ON CONFLICT specification
--
-- so every save failed, the error was swallowed by the action, and the UI
-- still showed a success toast. The table has therefore been empty this whole
-- time and no server push has ever been delivered.
--
-- The key is (user_id, endpoint) rather than (user_id). A push subscription
-- identifies one browser installation on one device, so keying on user_id
-- alone would mean a user who enables notifications on her phone and then on
-- her laptop silently loses the phone.
--
-- Safe to run more than once, and safe on a table that already has rows.

BEGIN;

-- 1. The endpoint, lifted out of the JSON so it can be indexed and compared.
--    Nullable at first because existing rows have to be backfilled before the
--    constraint can be added.
ALTER TABLE public.user_push_subscriptions
    ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- 2. Backfill from the stored subscription payload.
UPDATE public.user_push_subscriptions
   SET endpoint = subscription->>'endpoint'
 WHERE endpoint IS NULL
   AND subscription ? 'endpoint';

-- 3. Drop anything that cannot be keyed. A row with no endpoint could never
--    have been sent to — webpush.sendNotification requires one — so this
--    removes rows that were already dead weight rather than losing anything a
--    user would notice.
DELETE FROM public.user_push_subscriptions
 WHERE endpoint IS NULL
    OR btrim(endpoint) = '';

-- 4. Collapse duplicates, keeping the most recently updated row per
--    (user_id, endpoint). Duplicates are possible because every previous write
--    that reached the table at all did so as a plain insert.
DELETE FROM public.user_push_subscriptions AS duplicate
 USING public.user_push_subscriptions AS keeper
 WHERE duplicate.user_id  = keeper.user_id
   AND duplicate.endpoint = keeper.endpoint
   AND (
         duplicate.updated_at < keeper.updated_at
         OR (duplicate.updated_at = keeper.updated_at AND duplicate.id < keeper.id)
       );

-- 5. Now the column can be required.
ALTER TABLE public.user_push_subscriptions
    ALTER COLUMN endpoint SET NOT NULL;

-- 6. The constraint the application code has been referencing all along.
--    Written as a DO block because ADD CONSTRAINT has no IF NOT EXISTS, and
--    this migration has to stay re-runnable.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'user_push_subscriptions_user_endpoint_key'
    ) THEN
        ALTER TABLE public.user_push_subscriptions
            ADD CONSTRAINT user_push_subscriptions_user_endpoint_key
            UNIQUE (user_id, endpoint);
    END IF;
END
$$;

-- 7. Lookups by endpoint alone happen when a push service reports 404/410 and
--    the sender prunes the dead subscription.
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint
    ON public.user_push_subscriptions(endpoint);

-- The existing idx_push_sub_user is kept: (user_id, endpoint) can serve a
-- user_id-only lookup as a prefix, but dropping an index in the same migration
-- that adds a constraint makes a rollback harder than it needs to be.

COMMIT;
