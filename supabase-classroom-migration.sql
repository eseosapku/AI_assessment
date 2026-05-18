-- Classroom-first migration: tables, relationships, policies
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Classrooms (teacher-owned)
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (teacher_id, name)
);

-- Classroom memberships (invites + acceptance)
CREATE TABLE IF NOT EXISTS classroom_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (classroom_id, student_email)
);

-- Daily activity for analytics
CREATE TABLE IF NOT EXISTS user_activity_daily (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  seconds_active INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

-- Assignment results (required for classroom assignments)
CREATE TABLE IF NOT EXISTS assignment_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  result_id UUID REFERENCES results(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classroom-based assignment fields
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS questions_data JSONB;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS estimated_time INTEGER;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom_id ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student_id ON classroom_members(student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_status ON classroom_members(status);
CREATE INDEX IF NOT EXISTS idx_classroom_members_email ON classroom_members(student_email);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_id ON user_activity_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date ON user_activity_daily(activity_date);
CREATE INDEX IF NOT EXISTS idx_assignment_results_assignment_id ON assignment_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_student_id ON assignment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_results_email ON assignment_results(student_email);

-- Row Level Security
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage own classrooms" ON classrooms;
DROP POLICY IF EXISTS "Teachers can manage classroom members" ON classroom_members;
DROP POLICY IF EXISTS "Students can view own classroom memberships" ON classroom_members;
DROP POLICY IF EXISTS "Users can manage own activity" ON user_activity_daily;

CREATE POLICY "Teachers can manage own classrooms" ON classrooms
  FOR ALL USING (auth.uid()::text = teacher_id::text);

CREATE POLICY "Teachers can manage classroom members" ON classroom_members
  FOR ALL USING (auth.uid()::text = invited_by::text);

CREATE POLICY "Students can view own classroom memberships" ON classroom_members
  FOR SELECT USING (auth.uid()::text = student_id::text OR auth.uid()::text = invited_by::text);

CREATE POLICY "Users can manage own activity" ON user_activity_daily
  FOR ALL USING (auth.uid()::text = user_id::text);
