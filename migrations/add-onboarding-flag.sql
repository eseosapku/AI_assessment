-- Run on RDS when ready. Safe to skip locally — app falls back to localStorage.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN users.onboarding_completed IS 'True after user finishes first-run welcome flow.';
