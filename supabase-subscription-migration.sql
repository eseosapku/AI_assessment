-- Subscription paywall (Flutterwave)
-- Run in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_assessments_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flutterwave_ref VARCHAR(120);

COMMENT ON COLUMN users.subscription_status IS 'free | active | expired | cancelled';
COMMENT ON COLUMN users.free_assessments_used IS 'Count of successful AI assessment generations on free tier (max 2).';
COMMENT ON COLUMN users.flutterwave_ref IS 'Last Flutterwave transaction or subscription reference.';

-- Optional: migrate legacy NardoPay column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nardopay_ref'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'flutterwave_ref'
  ) THEN
    ALTER TABLE users RENAME COLUMN nardopay_ref TO flutterwave_ref;
  END IF;
END $$;
