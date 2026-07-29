-- University mode for StudySquare: an account is either a school student/teacher
-- or a university student. University users carry a course + year instead of a
-- country/grade. Additive and safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_level VARCHAR(20) NOT NULL DEFAULT 'school';
ALTER TABLE users ADD COLUMN IF NOT EXISTS university_course VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS university_year INTEGER;
COMMENT ON COLUMN users.education_level IS 'school | university';
COMMENT ON COLUMN users.university_course IS 'University course name (e.g. Medicine) when education_level = university';
COMMENT ON COLUMN users.university_year IS 'University year of study (1-6) when education_level = university';
