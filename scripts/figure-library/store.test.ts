// scripts/figure-library/store.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { SCHEMA, openStore, readJson } from './store'

describe('the staging store', () => {
  it('creates every table, and opening it again keeps what was there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-'))
    const file = path.join(dir, 'figures.db')
    const db = openStore(file, process.cwd())
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'rwanda', 'Biology S2 SB', 'biology', 'LS', 'Cells')").run()
    db.close()
    const again = openStore(file, process.cwd())
    const tables = (again.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['topics', 'subtopics', 'concepts', 'topic_map', 'subtopic_map', 'supply', 'spend']))
    expect((again.prepare('SELECT COUNT(*) AS n FROM topics').get() as { n: number }).n).toBe(1)
    again.close()
  })

  it('waits for a busy database instead of failing at once', () => {
    // The probe writes for hours; with no busy timeout a second writer failed in
    // 1 ms with "database is locked", after its model reply had been paid for.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-busy-'))
    const db = openStore(path.join(dir, 'figures.db'), process.cwd())
    expect((db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout).toBe(10_000)
    db.close()
  })

  it('refuses to live inside the repository', () => {
    // About 6 GB of figures cannot go through git or Amplify's bundle.
    expect(() => openStore(path.join(process.cwd(), 'data', 'figures.db'), process.cwd())).toThrow(/outside the repository/)
  })

  it('opens under jiti, which is how the pipeline scripts run', () => {
    // jiti 1.x rewrites "node:sqlite" to "sqlite", which does not exist; the
    // first real run of export-curriculum died on it while vitest passed.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-jiti-'))
    const script = path.join(dir, 'probe.ts')
    fs.writeFileSync(script, [
      `import { openStore } from ${JSON.stringify(path.resolve('scripts/figure-library/store.ts'))}`,
      "const db = openStore(':memory:')",
      "console.log((db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get() as { n: number }).n)",
    ].join('\n'))
    const out = execFileSync(process.execPath, [path.resolve('node_modules/jiti/bin/jiti.js'), script], { encoding: 'utf8' })
    expect(Number(out.trim())).toBeGreaterThan(5)
  }, 60_000)

  it('reads a damaged JSON column as the fallback', () => {
    expect(readJson('not json', [])).toEqual([])
    expect(readJson('["a"]', [])).toEqual(['a'])
  })

  it('reads a missing column as the fallback, not as null', () => {
    // A subtopic with no plan has a NULL kinds column; JSON.parse("null") is
    // null, and the first report crashed reading its length.
    expect(readJson(null, [])).toEqual([])
    expect(readJson(undefined, [])).toEqual([])
  })

  it('creates the figure tables from the schema file it shares with Python', () => {
    // scripts/figgen/store.py creates the same tables from the same file, so
    // the two languages cannot drift apart.
    const db = openStore(':memory:')
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['figures', 'figure_topics', 'figure_questions', 'reviews']))
    expect(SCHEMA).toBe(fs.readFileSync(path.resolve('scripts/figure-library/schema.sql'), 'utf8'))
    db.close()
  })

  it('keeps one review per figure per job', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO figures (id, origin, kind, subject, band, asset, status, created_at) VALUES ('drawn/x/1', 'drawn', 'graph.bar', 'mathematics', 'LS', 'assets/drawn/x/1.svg', 'stored', 'now')").run()
    const add = db.prepare("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('j', 'drawn/x/1', 'm', 1, '{}', 'now')")
    add.run()
    expect(() => add.run()).toThrow(/UNIQUE/)
    db.close()
  })

  it('has tables for real-image screenings and question checks', () => {
    const db = openStore(':memory:')
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['screenings', 'question_checks']))
    db.close()
  })
})
