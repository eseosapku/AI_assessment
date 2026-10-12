-- scripts/figure-library/schema.sql
-- Every table in the staging store (spec 5.6). Node (store.ts) and Python
-- (scripts/figgen/store.py) both create the store from this one file.
CREATE TABLE IF NOT EXISTS topics (
  key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  textbook_id INTEGER,
  book TEXT NOT NULL,
  subject TEXT NOT NULL,
  band TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopics (
  key TEXT PRIMARY KEY,
  topic_key TEXT NOT NULL REFERENCES topics(key),
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  bands TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS topic_map (
  topic_key TEXT PRIMARY KEY REFERENCES topics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL,
  terms TEXT NOT NULL,
  visual TEXT NOT NULL,
  dropped INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  mapped_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopic_map (
  subtopic_key TEXT PRIMARY KEY REFERENCES subtopics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supply (
  term TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  hits INTEGER NOT NULL,
  probed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  usd REAL NOT NULL,
  at TEXT NOT NULL
);
-- One figure, drawn or real (spec 5.4). A drawn figure keeps its seed and spec,
-- so it can be redrawn exactly. asset and preview are keys under the library
-- folder, laid out as the S3 keys will be: assets/drawn/<family>/<seed>.svg.
CREATE TABLE IF NOT EXISTS figures (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  family TEXT,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  band TEXT NOT NULL,
  concepts TEXT NOT NULL DEFAULT '[]',
  asset TEXT NOT NULL,
  preview TEXT,
  width INTEGER,
  height INTEGER,
  seed INTEGER,
  spec TEXT,
  licence TEXT,
  author TEXT,
  source_url TEXT,
  credit TEXT,
  phash TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS figures_by_family ON figures(family, seed);
CREATE TABLE IF NOT EXISTS figure_topics (
  figure_id TEXT NOT NULL REFERENCES figures(id),
  topic_key TEXT NOT NULL REFERENCES topics(key),
  PRIMARY KEY (figure_id, topic_key)
);
-- mcq: answer is the index of the correct option. short: answer is accepted[0].
CREATE TABLE IF NOT EXISTS figure_questions (
  id TEXT PRIMARY KEY,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  n INTEGER NOT NULL,
  band TEXT NOT NULL,
  kind TEXT NOT NULL,
  stem TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL,
  accepted TEXT NOT NULL DEFAULT '[]',
  explanation TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  model TEXT NOT NULL,
  pass INTEGER NOT NULL,
  detail TEXT NOT NULL,
  at TEXT NOT NULL,
  UNIQUE (job, figure_id)
);
-- What the screener saw in a real image and whether it kept it (spec 5.3 step 3).
CREATE TABLE IF NOT EXISTS screenings (
  figure_id TEXT PRIMARY KEY REFERENCES figures(id),
  model TEXT NOT NULL,
  keep INTEGER NOT NULL,
  shows TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL,
  at TEXT NOT NULL
);
-- Every question a model wrote and its checker's verdict (spec 5.3 step 6). Only kept
-- questions go into figure_questions; an image that got none has a row ending "#0".
CREATE TABLE IF NOT EXISTS question_checks (
  question_id TEXT PRIMARY KEY,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  writer TEXT NOT NULL,
  keep INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  at TEXT NOT NULL
);
