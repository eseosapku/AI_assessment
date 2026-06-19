-- Migration: allow login with email or student ID
-- Run in Supabase SQL editor

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN student_id DROP NOT NULL;

UPDATE users SET email = NULL WHERE email = '';
UPDATE users SET student_id = NULL WHERE student_id = '';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_student_id_chk;
ALTER TABLE users ADD CONSTRAINT users_email_or_student_id_chk
  CHECK ((email IS NOT NULL AND email <> '') OR (student_id IS NOT NULL AND student_id <> ''));
