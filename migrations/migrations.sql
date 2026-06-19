-- Add strict_mode to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN DEFAULT false;

-- Add submission tracking to results table
ALTER TABLE results ADD COLUMN IF NOT EXISTS submission_reason VARCHAR(50) DEFAULT 'manual';
ALTER TABLE results ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;

-- Add index for submission_reason queries
CREATE INDEX IF NOT EXISTS idx_results_submission_reason ON results(submission_reason);
