// scripts/figure-library/store.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore, readJson } from './store'

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

  it('refuses to live inside the repository', () => {
    // About 6 GB of figures cannot go through git or Amplify's bundle.
    expect(() => openStore(path.join(process.cwd(), 'data', 'figures.db'), process.cwd())).toThrow(/outside the repository/)
  })

  it('reads a damaged JSON column as the fallback', () => {
    expect(readJson('not json', [])).toEqual([])
    expect(readJson('["a"]', [])).toEqual(['a'])
  })
})
