-- Students had no way to say a question was wrong, and no way to challenge a
-- mark an AI gave them. Both hurt trust, and both are the cheapest quality
-- signal the product could have: a "this looks wrong" button would have
-- surfaced the duplicate-shapes questions and the rainfall photo without
-- paying for a usability study.

CREATE TABLE IF NOT EXISTS question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Kept even if the assessment is deleted: the report is still evidence
  -- about generation quality.
  assessment_id UUID,
  result_id UUID,
  -- Zero-based position in the paper.
  question_index INTEGER NOT NULL,
  -- wrong_answer | confusing | irrelevant_image | duplicate | offensive |
  -- grading (a challenge to an AI mark) | other
  reason VARCHAR(40) NOT NULL,
  detail TEXT,
  -- A copy of the question as it was seen. Without this a report is
  -- unusable once the paper is regenerated or edited.
  question_snapshot JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open | reviewed | actioned | dismissed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The review queue is read newest-first, filtered by status.
CREATE INDEX IF NOT EXISTS idx_question_reports_status_created
  ON question_reports (status, created_at DESC);

-- "Show me everything reported about this assessment."
CREATE INDEX IF NOT EXISTS idx_question_reports_assessment
  ON question_reports (assessment_id);
