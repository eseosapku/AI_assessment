-- The figure library in production (docs/superpowers/specs/2026-10-16-figure-library-production-design.md 3.1).
-- Additive only; filled by scripts/figure-library/publish.ts, which applies this file first.
CREATE TABLE IF NOT EXISTS figure_library (
  id text PRIMARY KEY,
  origin text NOT NULL,
  family text,
  kind text NOT NULL,
  subject text NOT NULL,
  band text NOT NULL,
  asset text NOT NULL,
  preview text,
  width integer,
  height integer,
  credit text,
  shows text,
  topic text,
  book text,
  books text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS figure_library_topics (
  topic_id integer NOT NULL,
  figure_id text NOT NULL REFERENCES figure_library(id),
  PRIMARY KEY (topic_id, figure_id)
);
CREATE TABLE IF NOT EXISTS figure_library_questions (
  id text PRIMARY KEY,
  figure_id text NOT NULL REFERENCES figure_library(id),
  n integer NOT NULL,
  kind text NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  answer text NOT NULL,
  accepted jsonb NOT NULL DEFAULT '[]',
  explanation text NOT NULL DEFAULT '',
  tolerance real NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS figure_library_questions_figure ON figure_library_questions (figure_id);
