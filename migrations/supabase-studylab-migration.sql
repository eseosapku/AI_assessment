-- StudyLab migration
-- Run this in the Supabase SQL Editor (same style as the other supabase-*.sql files).
-- Adds the spatial AI-tutor "LearnSpace" tables plus the topic-level mastery
-- groundwork that powers the Phase 2 Learning Gap Map.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── LearnSpaces ───────────────────────────────────────────────────────────────
-- A LearnSpace is one spatial study workspace (canvas + chat) for a user.
CREATE TABLE IF NOT EXISTS learnspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(150),
  -- 'scratch' = brand new topic with no prior AI inference,
  -- 'gap'     = seeded from a Learning Gap (Phase 2).
  origin VARCHAR(20) NOT NULL DEFAULT 'scratch',
  -- Optional curriculum anchoring (used when origin = 'gap').
  textbook_id INTEGER,
  topic_id INTEGER,
  subtopic_id INTEGER,
  -- React Flow nodes/edges + tldraw document, persisted as one JSON blob.
  canvas_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnspaces_user_id ON learnspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_learnspaces_updated_at ON learnspaces(updated_at DESC);

-- ── LearnSpace chat transcript ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learnspace_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learnspace_id UUID REFERENCES learnspaces(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,            -- 'user' | 'assistant'
  content TEXT NOT NULL DEFAULT '',
  actions JSONB,                        -- canvas actions emitted by the assistant turn
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnspace_messages_learnspace_id
  ON learnspace_messages(learnspace_id, created_at);

-- ── Phase 2 groundwork: tag assessments with the curriculum they target ───────
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS textbook_id INTEGER;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS topic_ids INTEGER[] DEFAULT '{}';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS subtopic_ids INTEGER[] DEFAULT '{}';

-- ── Phase 2 groundwork: per-subtopic mastery aggregate ────────────────────────
-- Updated whenever a result is saved, so the Learning Gap Map can read real
-- topic-level performance instead of guessing from question text.
CREATE TABLE IF NOT EXISTS topic_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  textbook_id INTEGER,
  topic_id INTEGER,
  subtopic_id INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  accuracy DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_assessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, textbook_id, topic_id, subtopic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_id ON topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic ON topic_mastery(topic_id);
