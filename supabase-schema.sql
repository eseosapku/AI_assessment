-- AI Assessment Platform Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  class VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student', -- 'student' | 'teacher'
  subjects TEXT[] DEFAULT '{}',
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  questions_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Results Table
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  feedback JSONB,
  time_taken INTEGER, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments Table (drafts + sent to classroom)
-- Stores assessment parameters; questions_data is stored for teacher preview/edit
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment/Classroom mapping (supports multiple classrooms per assignment)
CREATE TABLE IF NOT EXISTS assignment_classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (assignment_id, classroom_id)
);

-- Assignment Results — tracks each student's progress on an assignment
CREATE TABLE IF NOT EXISTS assignment_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending | started | completed
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  result_id UUID REFERENCES results(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classrooms (teacher-owned) and memberships
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (teacher_id, name)
);

CREATE TABLE IF NOT EXISTS classroom_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (classroom_id, student_email)
);

-- Daily user activity (for analytics)
CREATE TABLE IF NOT EXISTS user_activity_daily (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  seconds_active INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

-- Add columns to existing tables if missing (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE assignments ALTER COLUMN grade TYPE VARCHAR(50);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS questions_data JSONB;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS estimated_time INTEGER;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN DEFAULT false;
ALTER TABLE results ADD COLUMN IF NOT EXISTS submission_reason VARCHAR(50) DEFAULT 'manual';
ALTER TABLE results ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_assessment_id ON results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_results_submission_reason ON results(submission_reason);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignment_classrooms_assignment_id ON assignment_classrooms(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_classrooms_classroom_id ON assignment_classrooms(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_assignment_id ON assignment_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_student_id ON assignment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom_id ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student_id ON classroom_members(student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_status ON classroom_members(status);
CREATE INDEX IF NOT EXISTS idx_classroom_members_email ON classroom_members(student_email);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_id ON user_activity_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date ON user_activity_daily(activity_date);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_daily ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (safe to re-run)
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can view own assessments" ON assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON assessments;
DROP POLICY IF EXISTS "Users can update own assessments" ON assessments;
DROP POLICY IF EXISTS "Users can view own results" ON results;
DROP POLICY IF EXISTS "Users can create own results" ON results;
DROP POLICY IF EXISTS "Teachers can manage own assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can manage assignment classrooms" ON assignment_classrooms;
DROP POLICY IF EXISTS "Students can view own assignment results" ON assignment_results;
DROP POLICY IF EXISTS "Students can update own assignment results" ON assignment_results;
DROP POLICY IF EXISTS "Teachers can manage own classrooms" ON classrooms;
DROP POLICY IF EXISTS "Teachers can manage classroom members" ON classroom_members;
DROP POLICY IF EXISTS "Students can view own classroom memberships" ON classroom_members;
DROP POLICY IF EXISTS "Users can manage own activity" ON user_activity_daily;

-- Users policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Assessments policies
CREATE POLICY "Users can view own assessments" ON assessments
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create own assessments" ON assessments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);
CREATE POLICY "Users can update own assessments" ON assessments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Results policies
CREATE POLICY "Users can view own results" ON results
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create own results" ON results
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Assignments policy (teachers manage their own)
CREATE POLICY "Teachers can manage own assignments" ON assignments
  FOR ALL USING (auth.uid()::text = teacher_id::text);

-- Assignment/classroom mapping policy (teachers manage their own assignments)
CREATE POLICY "Teachers can manage assignment classrooms" ON assignment_classrooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_classrooms.assignment_id
      AND auth.uid()::text = assignments.teacher_id::text
    )
  );

-- Assignment results policies
CREATE POLICY "Students can view own assignment results" ON assignment_results
  FOR SELECT USING (auth.uid()::text = student_id::text);
CREATE POLICY "Students can update own assignment results" ON assignment_results
  FOR UPDATE USING (auth.uid()::text = student_id::text);

-- Classrooms policies
CREATE POLICY "Teachers can manage own classrooms" ON classrooms
  FOR ALL USING (auth.uid()::text = teacher_id::text);

CREATE POLICY "Teachers can manage classroom members" ON classroom_members
  FOR ALL USING (auth.uid()::text = invited_by::text);

CREATE POLICY "Students can view own classroom memberships" ON classroom_members
  FOR SELECT USING (auth.uid()::text = student_id::text OR auth.uid()::text = invited_by::text);

-- Activity policy
CREATE POLICY "Users can manage own activity" ON user_activity_daily
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users.updated_at (drop first so it's safe to re-run)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
T e x t b o o k s 
 
 T o p i c s 
 
 a n d 
 
 S u b t o p i c s 
 
 c u r r i c u l u m 
 
 I N T E G E R 
 
 D E F A U L T 
 
 0 
 
 n a m e 
 
 V A R C H A R 
 
 2 5 5 
 
 N O T 
 
 N U L L 
 
 n a m e 
 
 V A R C H A R 
 
 2 5 5 
 
 N O T 
 
 N U L L 
 
 
-- Textbooks, Topics, and Subtopics
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

-- Classes and Class Textbooks (Subjects) mapping
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
