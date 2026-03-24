-- Migration: Add topics field to assessments table
-- Run this in your Supabase SQL Editor if the field doesn't exist

-- Add topics column if it doesn't already exist
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

-- Update existing assessments to have empty topics array (if NULL)
UPDATE assessments 
SET topics = '{}' 
WHERE topics IS NULL;

-- Add an index on topics for better query performance
CREATE INDEX IF NOT EXISTS idx_assessments_topics ON assessments USING GIN (topics);
