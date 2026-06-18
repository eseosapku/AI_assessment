-- Subscription paywall (NardoPay)
-- Run in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_assessments_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nardopay_ref VARCHAR(120);

COMMENT ON COLUMN users.subscription_status IS 'free | active | expired | cancelled';
COMMENT ON COLUMN users.free_assessments_used IS 'Count of successful AI assessment generations on free tier (max 2).';
COMMENT ON COLUMN users.nardopay_ref IS 'Last NardoPay transaction or subscription reference from webhook.';

-- Grandfather all existing accounts as paid subscribers (only new signups after this migration start on free tier).
UPDATE users
SET
  subscription_status = 'active',
  subscription_started_at = COALESCE(subscription_started_at, NOW())
WHERE subscription_status = 'free';
