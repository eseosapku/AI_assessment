-- ============================================================================
-- Brain Ink / AI Assessment Platform - Full Database Schema (PostgreSQL)
-- ============================================================================
-- Purpose:
--   Single canonical schema file for fresh database setup on Amazon RDS/Aurora.
--
-- Notes:
--   1) This file creates ALL current application tables in dependency-safe order.
--   2) Includes all columns introduced by later migrations
--      (max_attempts, strict_mode, submission_reason, violation_count, ai_jobs, etc).
--   3) Uses gen_random_uuid() from pgcrypto for UUID primary keys.
--   4) Does NOT include Supabase-specific RLS policies (auth.uid()) because this
--      deployment targets plain PostgreSQL on AWS RDS.
--
-- Suggested execution:
--   Run the entire file once against an empty database.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Core Identity
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  class VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student', -- student | teacher
  subjects TEXT[] DEFAULT '{}',
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Curriculum / Catalog
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS textbooks (
  textbook_id SERIAL PRIMARY KEY,
  textbook_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  curriculum INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  topic_id SERIAL PRIMARY KEY,
  textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS subtopics (
  subtopic_id SERIAL PRIMARY KEY,
  textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(topic_id) ON DELETE CASCADE,
  subtopic VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_textbooks (
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, textbook_id)
);

-- ----------------------------------------------------------------------------
-- Classroom Domain
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (teacher_id, name)
);

CREATE TABLE IF NOT EXISTS classroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (classroom_id, student_email)
);

CREATE TABLE IF NOT EXISTS user_activity_daily (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  seconds_active INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

-- ----------------------------------------------------------------------------
-- Assessments / Results
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  questions_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending | completed | expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  feedback JSONB,
  time_taken INTEGER, -- seconds
  submission_reason VARCHAR(50) DEFAULT 'manual', -- manual | timer | violation
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Assignment Domain
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  teacher_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  topics TEXT[] NOT NULL,
  grade VARCHAR(50) NOT NULL,
  curriculum VARCHAR(50) NOT NULL,
  difficulty_level VARCHAR(50) NOT NULL,
  question_count INTEGER NOT NULL,
  style VARCHAR(100) NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  questions_data JSONB,
  estimated_time INTEGER,
  deadline TIMESTAMP WITH TIME ZONE,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  strict_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (assignment_id, classroom_id)
);

CREATE TABLE IF NOT EXISTS assignment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending | started | completed
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  result_id UUID REFERENCES results(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Async AI Jobs (Lambda/SQS orchestration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,      -- generate_assessment | grade_longform | generate_feedback
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued | running | succeeded | failed
  input_payload JSONB NOT NULL,
  result_payload JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);

CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_assessment_id ON results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_results_submission_reason ON results(submission_reason);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom_id ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student_id ON classroom_members(student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_status ON classroom_members(status);
CREATE INDEX IF NOT EXISTS idx_classroom_members_email ON classroom_members(student_email);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_id ON user_activity_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date ON user_activity_daily(activity_date);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

CREATE INDEX IF NOT EXISTS idx_assignment_classrooms_assignment_id ON assignment_classrooms(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_classrooms_classroom_id ON assignment_classrooms(classroom_id);

CREATE INDEX IF NOT EXISTS idx_assignment_results_assignment_id ON assignment_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_student_id ON assignment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_email ON assignment_results(student_email);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type_status ON ai_jobs(job_type, status);

-- ----------------------------------------------------------------------------
-- Updated-at trigger utility
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classrooms_updated_at ON classrooms;
CREATE TRIGGER update_classrooms_updated_at
  BEFORE UPDATE ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- Relationship Summary (Entity Graph)
-- ============================================================================
-- users (1) ----< assessments (many)
-- users (1) ----< results (many)
-- assessments (1) ----< results (many)
--
-- users (teacher role) (1) ----< classrooms (many)
-- classrooms (1) ----< classroom_members (many)
-- users (student role) (1) ----< classroom_members (many; nullable by email invite flow)
--
-- users (teacher role) (1) ----< assignments (many)
-- classrooms (1) ----< assignments (many; optional direct classroom_id)
-- assignments (many) ----<---- (many) classrooms via assignment_classrooms
--
-- assignments (1) ----< assignment_results (many)
-- users (student role) (1) ----< assignment_results (many; nullable with email-first flow)
-- assessments (1) ----< assignment_results (many; nullable)
-- results (1) ----< assignment_results (many; nullable)
--
-- users (1) ----< user_activity_daily (many by date)
--
-- textbooks (1) ----< topics (many)
-- topics (1) ----< subtopics (many)
-- textbooks (1) ----< subtopics (many)
-- classes (many) ----<---- (many) textbooks via class_textbooks
--
-- ai_jobs is operational infrastructure table for async AI orchestration.
-- ============================================================================
