-- Longform student hints: assignment-level toggle (default on)
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS hints_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN assignments.hints_enabled IS
  'When true, students may reveal scaffolding hints on longform questions during the attempt. Practice always allows hints.';
