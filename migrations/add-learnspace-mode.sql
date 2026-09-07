-- migrations/add-learnspace-mode.sql
-- StudyLab teaching mode. 'classic' = existing text-card tutor (default, unchanged).
-- 'montessori' = activity-led tutor that emits interactive manipulables.
ALTER TABLE learnspaces
  ADD COLUMN IF NOT EXISTS mode VARCHAR(16) NOT NULL DEFAULT 'classic';
