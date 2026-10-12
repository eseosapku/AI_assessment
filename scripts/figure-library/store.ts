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

/**
 * Every table in the store. Kept in schema.sql because the Python figure
 * generator (scripts/figgen/store.py) creates the store from the same file.
 */
export const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')

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
  // Wait up to 10 s for another writer (the probe runs for hours) rather than
  // failing at once and losing a spend record for a reply already paid for.
  db.exec('PRAGMA busy_timeout = 10000')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

/** Parses a JSON column, falling back rather than throwing on a damaged or missing value. */
export function readJson<T>(text: unknown, fallback: T): T {
  if (text === null || text === undefined) return fallback
  try {
    const value = JSON.parse(String(text)) as T | null
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}
