-- One Flutterwave payment could be replayed against /verify for any user_id,
-- and every replay pushed the expiry out again: nothing recorded that a
-- transaction had been spent. The charge amount also came from the request
-- body, so a payment has to be checked against the price the server quoted
-- when it opened the checkout, not against anything the browser sent.

-- What the server asked for, keyed by the tx_ref it generated.
CREATE TABLE IF NOT EXISTS subscription_checkouts (
  tx_ref VARCHAR(120) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Each Flutterwave transaction appears here once. The primary key is what
-- stops a second activation, including /verify racing the webhook.
CREATE TABLE IF NOT EXISTS subscription_payments (
  transaction_id VARCHAR(120) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_ref VARCHAR(120),
  amount NUMERIC(14, 2),
  currency VARCHAR(3),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user
  ON subscription_payments (user_id);

-- Wrong reset codes cost nothing, so six digits could be walked inside the
-- 15-minute window. The count lives on the row so every instance sees it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_attempts INTEGER NOT NULL DEFAULT 0;
