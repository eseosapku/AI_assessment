-- The lesson's control flow: phase, per-step status, pace, and any open check.
-- Separate from canvas_state because it is lesson structure, not canvas
-- content, and it carries status the whiteboard has no business owning.
ALTER TABLE learnspaces
  ADD COLUMN IF NOT EXISTS lesson_run jsonb;

COMMENT ON COLUMN learnspaces.lesson_run IS
  'LessonRun: phase, steps with status and locks, pace, open check. Null on rows saved before runs existed; derived from canvas_state.plan and current_step on read.';
