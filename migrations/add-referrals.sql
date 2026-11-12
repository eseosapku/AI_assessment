-- Referral discounts, ownership and privacy-safe redemption tracking.

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discount_percentage NUMERIC(5, 2) NOT NULL
    CHECK (discount_percentage > 0 AND discount_percentage < 100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (code = UPPER(code))
);

ALTER TABLE subscription_checkouts
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id VARCHAR(120) NOT NULL UNIQUE,
  amount_paid NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_code_time
  ON referral_redemptions (referral_code_id, redeemed_at DESC);
