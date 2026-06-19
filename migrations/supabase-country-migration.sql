-- Country support + Nigeria curriculum classes
-- Safe for existing users: all default to Rwanda (RW)

ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'RW';

ALTER TABLE classes ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'RW';

-- Backfill existing rows explicitly (idempotent)
UPDATE users SET country = 'RW' WHERE country IS NULL OR country = '';
UPDATE classes SET country = 'RW' WHERE country IS NULL OR country = '';

COMMENT ON COLUMN users.country IS 'ISO-style country code: RW=Rwanda, NG=Nigeria. Existing users remain RW.';
COMMENT ON COLUMN classes.country IS 'Country this class belongs to. RW for Grade N, NG for P1-SS3.';
COMMENT ON COLUMN textbooks.curriculum IS '0=REB Rwanda, 1=Cambridge global, 2=NERDC Nigeria, 3=WAEC exam prep, 4=JAMB exam prep';
