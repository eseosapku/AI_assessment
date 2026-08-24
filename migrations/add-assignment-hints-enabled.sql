-- Teacher toggle: whether students may open longform hints on this assignment.
-- Practice quizzes are not assignments — they always allow hints.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS hints_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN assignments.hints_enabled IS
  'When false, students taking this assignment do not receive longform hints. Practice quizzes ignore this flag and always allow hints.';
