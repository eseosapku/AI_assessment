-- Google OAuth support for StudySquare auth
-- Run once against RDS/Postgres before enabling Google sign-in.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'password';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
  ON users (google_id)
  WHERE google_id IS NOT NULL;

COMMENT ON COLUMN users.google_id IS 'Google subject (sub) from ID token; unique when present.';
COMMENT ON COLUMN users.profile_complete IS 'FALSE until a Google-first user finishes role/class setup.';
COMMENT ON COLUMN users.auth_provider IS 'password | google | both';
