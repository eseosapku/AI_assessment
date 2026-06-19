-- ============================================================================
-- Brain Ink / AI Assessment Platform - Full Database Schema (PostgreSQL)
-- ============================================================================
-- Purpose:
--   Single canonical schema file for fresh database setup on Amazon RDS/Aurora.
--
-- Consolidates:
--   - supabase-schema.sql / supabase-simple-schema.sql (core tables)
--   - supabase-auth-migration.sql (email OR student_id login)
--   - supabase-classroom-migration.sql (classrooms, assignments linkage)
--   - supabase-country-migration.sql (country on users/classes)
--   - supabase-assignment-attempts.sql (max_attempts, attempt tracking)
--   - migrations.sql (strict_mode, submission_reason, violation_count)
--   - supabase-ai-jobs-migration.sql (async AI job queue)
--   - supabase-subscription-migration.sql (Flutterwave paywall)
--   - supabase-exam-sources-migration.sql (exam/textbook source columns)
--   - supabase-studylab-migration.sql (LearnSpace + topic mastery)
--
-- Notes:
--   1) Creates ALL application tables in dependency-safe order.
--   2) Uses gen_random_uuid() from pgcrypto for UUID primary keys.
--   3) Does NOT include Supabase-specific RLS policies (auth.uid()).
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
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  student_id VARCHAR(50) UNIQUE,
  class VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student', -- student | teacher
  subjects TEXT[] DEFAULT '{}',
  country VARCHAR(2) NOT NULL DEFAULT 'RW', -- RW=Rwanda, NG=Nigeria
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'free', -- free | active | expired | cancelled
  free_assessments_used INTEGER NOT NULL DEFAULT 0,
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  flutterwave_ref VARCHAR(120),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT users_email_or_student_id_chk
    CHECK ((email IS NOT NULL AND email <> '') OR (student_id IS NOT NULL AND student_id <> ''))
);

COMMENT ON COLUMN users.country IS 'ISO-style country code: RW=Rwanda, NG=Nigeria. Existing users remain RW.';
COMMENT ON COLUMN users.subscription_status IS 'free | active | expired | cancelled';
COMMENT ON COLUMN users.free_assessments_used IS 'Count of successful AI assessment generations on free tier (max 2).';
COMMENT ON COLUMN users.flutterwave_ref IS 'Last Flutterwave transaction or subscription reference.';

-- ----------------------------------------------------------------------------
-- Curriculum / Catalog
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS textbooks (
  textbook_id SERIAL PRIMARY KEY,
  textbook_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  curriculum INTEGER DEFAULT 0, -- 0=REB Rwanda, 1=Cambridge, 2=NERDC Nigeria, 3=WAEC, 4=JAMB
  source_text TEXT,
  source_url TEXT,
  source_authority VARCHAR(120),
  exam_year INTEGER,
  exam_subject VARCHAR(120),
  exam_diet VARCHAR(60),
  source_char_count INTEGER
);

COMMENT ON COLUMN textbooks.curriculum IS '0=REB Rwanda, 1=Cambridge global, 2=NERDC Nigeria, 3=WAEC exam prep, 4=JAMB exam prep';
COMMENT ON COLUMN textbooks.source_text IS 'Extracted PDF text for past papers or textbooks — used as AI source material.';
COMMENT ON COLUMN textbooks.exam_year IS 'Exam year for WAEC/JAMB past papers (curriculum 3/4).';
COMMENT ON COLUMN textbooks.exam_subject IS 'Normalized subject name for exam papers.';
COMMENT ON COLUMN textbooks.exam_diet IS 'Exam sitting: may-june, nov-dec, utme, etc.';

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
  country VARCHAR(2) DEFAULT 'RW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN classes.country IS 'Country this class belongs to. RW for Grade N, NG for P1-SS3.';

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
  textbook_id INTEGER,
  topic_ids INTEGER[] DEFAULT '{}',
  subtopic_ids INTEGER[] DEFAULT '{}',
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
  grade VARCHAR(10),
  feedback JSONB,
  questions_data JSONB,
  longform_grades JSONB,
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
-- StudyLab (LearnSpace spatial tutor + topic mastery)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learnspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(150),
  origin VARCHAR(20) NOT NULL DEFAULT 'scratch', -- scratch | gap
  textbook_id INTEGER,
  topic_id INTEGER,
  subtopic_id INTEGER,
  canvas_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learnspace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learnspace_id UUID REFERENCES learnspaces(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user | assistant
  content TEXT NOT NULL DEFAULT '',
  actions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ----------------------------------------------------------------------------
-- Async AI Jobs (Lambda/SQS orchestration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL, -- generate_assessment | grade_longform | generate_feedback
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
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

CREATE INDEX IF NOT EXISTS idx_textbooks_curriculum ON textbooks(curriculum);
CREATE INDEX IF NOT EXISTS idx_textbooks_exam_year ON textbooks(exam_year);
CREATE INDEX IF NOT EXISTS idx_textbooks_exam_subject ON textbooks(exam_subject);

CREATE INDEX IF NOT EXISTS idx_topics_textbook_id ON topics(textbook_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_textbook_id ON subtopics(textbook_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);

CREATE INDEX IF NOT EXISTS idx_classes_country ON classes(country);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_textbook_id ON assessments(textbook_id);

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

CREATE INDEX IF NOT EXISTS idx_learnspaces_user_id ON learnspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_learnspaces_updated_at ON learnspaces(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_learnspace_messages_learnspace_id
  ON learnspace_messages(learnspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_id ON topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic ON topic_mastery(topic_id);

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

DROP TRIGGER IF EXISTS update_learnspaces_updated_at ON learnspaces;
CREATE TRIGGER update_learnspaces_updated_at
  BEFORE UPDATE ON learnspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_topic_mastery_updated_at ON topic_mastery;
CREATE TRIGGER update_topic_mastery_updated_at
  BEFORE UPDATE ON topic_mastery
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
-- users (1) ----< learnspaces (many)
-- learnspaces (1) ----< learnspace_messages (many)
-- users (1) ----< topic_mastery (many)
--
-- textbooks (1) ----< topics (many)
-- topics (1) ----< subtopics (many)
-- textbooks (1) ----< subtopics (many)
-- classes (many) ----<---- (many) textbooks via class_textbooks
--
-- ai_jobs is operational infrastructure table for async AI orchestration.
-- ============================================================================