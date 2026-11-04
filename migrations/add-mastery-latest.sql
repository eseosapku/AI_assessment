-- Gap Map: judge a section on its latest attempt. Additive only; old code ignores these columns.
-- NOT yet run on the live database (needs the owner's go).
ALTER TABLE topic_mastery ADD COLUMN IF NOT EXISTS last_accuracy DECIMAL(5,2);
ALTER TABLE topic_mastery ADD COLUMN IF NOT EXISTS lowest_accuracy DECIMAL(5,2);
ALTER TABLE topic_mastery ADD COLUMN IF NOT EXISTS pending_correct REAL NOT NULL DEFAULT 0;
ALTER TABLE topic_mastery ADD COLUMN IF NOT EXISTS pending_total REAL NOT NULL DEFAULT 0;
