-- AI Assessment Platform Database Schema (Simplified)
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  class VARCHAR(100) NOT NULL,
  subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessments Table
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  duration INTEGER NOT NULL,
  questions_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Results Table
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  feedback JSONB,
  time_taken INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Textbooks, Topics, and Subtopics
-- CREATE TABLE textbooks (
--   textbook_id SERIAL PRIMARY KEY,
--   textbook_name VARCHAR(255) NOT NULL,
--   filename VARCHAR(255),
--   curriculum INTEGER DEFAULT 0
-- );

-- CREATE TABLE topics (
--   topic_id SERIAL PRIMARY KEY,
--   textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
--   topic VARCHAR(255) NOT NULL
-- );

-- CREATE TABLE subtopics (
--   subtopic_id SERIAL PRIMARY KEY,
--   textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
--   topic_id INTEGER REFERENCES topics(topic_id) ON DELETE CASCADE,
--   subtopic VARCHAR(255) NOT NULL
-- );

-- Classes and Class Textbooks mapping
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE class_textbooks (
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  textbook_id INTEGER REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, textbook_id)
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_results_user_id ON results(user_id);
CREATE INDEX idx_results_assessment_id ON results(assessment_id);


-- Password Reset Tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
