-- Expand country codes beyond VARCHAR(2) (optional — app maps INT -> XX until this runs).
-- Safe to run on RDS; existing RW/NG/XX rows unchanged.

ALTER TABLE users ALTER COLUMN country TYPE VARCHAR(10);
ALTER TABLE classes ALTER COLUMN country TYPE VARCHAR(10);

UPDATE users SET country = 'INT' WHERE country = 'XX';
UPDATE classes SET country = 'INT' WHERE country = 'XX';

COMMENT ON COLUMN users.country IS 'Country code: RW, NG, INT (international), KE, GH, etc.';
COMMENT ON COLUMN classes.country IS 'Country this class belongs to.';
