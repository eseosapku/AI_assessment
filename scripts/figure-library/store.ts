// scripts/figure-library/store.ts
import fs from 'node:fs'
import path from 'node:path'
// Loaded straight from Node, not imported: jiti 1.x, which runs the pipeline
// scripts, rewrites "node:sqlite" to "sqlite", and sqlite has no unprefixed
// name. A type-only import is erased, so jiti never sees it.
const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: 'node:sqlite'): typeof import('node:sqlite') })
  .getBuiltinModule('node:sqlite')

/**
 * Where the library is built until S3 exists (spec 5.6). Outside the
 * repository on purpose: about 6 GB of figures cannot go through git or
 * Amplify's 230 MB bundle.
 */
export function libraryDir(): string {
  return path.resolve(process.env.FIGURE_LIBRARY_DIR || 'C:/Users/Stephen/figure-library')
}

export const SCHEMA = `
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
`

export type Store = import('node:sqlite').DatabaseSync

export function openStore(file: string = path.join(libraryDir(), 'figures.db'), repoRoot: string = process.cwd()): Store {
  if (file !== ':memory:') {
    const abs = path.resolve(file)
    const rel = path.relative(path.resolve(repoRoot), abs)
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw new Error(`The figure library must live outside the repository, not at ${abs}`)
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
  }
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

/** Parses a JSON column, falling back rather than throwing on a damaged row. */
export function readJson<T>(text: unknown, fallback: T): T {
  try {
    return JSON.parse(String(text)) as T
  } catch {
    return fallback
  }
}
