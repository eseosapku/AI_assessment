-- Source material columns for exam past papers (curriculum 3/4) and NERDC textbooks (curriculum 2)
-- Run after supabase-country-migration.sql

ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS source_text TEXT;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS source_authority VARCHAR(120);
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS exam_year INTEGER;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS exam_subject VARCHAR(120);
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS exam_diet VARCHAR(60);
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS source_char_count INTEGER;

COMMENT ON COLUMN textbooks.source_text IS 'Extracted PDF text for past papers or textbooks — used as AI source material.';
COMMENT ON COLUMN textbooks.exam_year IS 'Exam year for WAEC/JAMB past papers (curriculum 3/4).';
COMMENT ON COLUMN textbooks.exam_subject IS 'Normalized subject name for exam papers.';
COMMENT ON COLUMN textbooks.exam_diet IS 'Exam sitting: may-june, nov-dec, utme, etc.';
