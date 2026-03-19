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

-- Assignments Table (teacher → student)
-- Stores assessment parameters; fresh questions are generated per student on start
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  teacher_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  topics TEXT[] NOT NULL,
  grade INTEGER NOT NULL,
  curriculum VARCHAR(50) NOT NULL,
  difficulty_level VARCHAR(50) NOT NULL,
  question_count INTEGER NOT NULL,
  style VARCHAR(100) NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  student_emails TEXT[] NOT NULL DEFAULT '{}',
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_assessment_id ON results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_assignment_id ON assignment_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_student_id ON assignment_results(student_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_results ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Assessments
CREATE POLICY "Users can view own assessments" ON assessments
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create own assessments" ON assessments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own assessments" ON assessments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Results
CREATE POLICY "Users can view own results" ON results
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create own results" ON results
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Assignments (teachers manage, students view by email)
CREATE POLICY "Teachers can manage own assignments" ON assignments
  FOR ALL USING (auth.uid()::text = teacher_id::text);

-- Assignment results
CREATE POLICY "Students can view own assignment results" ON assignment_results
  FOR SELECT USING (auth.uid()::text = student_id::text);
CREATE POLICY "Students can update own assignment results" ON assignment_results
  FOR UPDATE USING (auth.uid()::text = student_id::text);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration: add role column to existing users table if not present
-- Run this if you already have the users table without the role column:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
-- ALTER TABLE users ALTER COLUMN class DROP NOT NULL; -- optional: allow null for future flexibility
