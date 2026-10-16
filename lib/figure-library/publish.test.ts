import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../../scripts/figure-library/store'
import { stagingBatches, writeBatch, type PublishBatch } from './publish'

function makeStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-pub-'))
  const file = path.join(dir, 'figures.db')
  const db = openStore(file, process.cwd())
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:2', 'cambridge', 77, 'IGCSE Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('jamb:Bio:1', 'jamb', NULL, 'JAMB Biology', 'biology', 'UP', 'Cells')").run()
  const fig = (id: string, origin: string, status: string, family: string | null, kind: string, credit: string | null, topics: string[], spec = '{}') => {
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, spec, credit, status, created_at)
      VALUES (?, ?, ?, ?, 'biology', 'UP', ?, ?, ?, ?, ?, 'now')`).run(id, origin, family, kind, `assets/${id}.svg`, `assets/${id}.png`, spec, credit, status)
    for (const t of topics) db.prepare('INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, ?)').run(id, t)
  }
  fig('wikimedia/1', 'wikimedia', 'approved', null, 'photo.micrograph', 'By A, CC BY 4.0', ['db:2'])
  fig('drawn/bar_chart/1', 'drawn', 'approved', 'bar_chart', 'graph.bar', null, ['db:2', 'jamb:Bio:1'], '{"title": "Rain"}')
  fig('drawn/bar_chart/2', 'drawn', 'approved', 'bar_chart', 'graph.bar', null, ['jamb:Bio:1'])
  fig('drawn/bar_chart/3', 'drawn', 'rejected', 'bar_chart', 'graph.bar', null, ['db:2'])
  db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES ('wikimedia/1', 'm', 1, 'Onion cells', '{}', 'now')").run()
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model) VALUES
    ('wikimedia/1#1', 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dot?', '["Nucleus","Wall"]', '0', '[]', 'DNA.', 'sonnet'),
    ('wikimedia/1#2', 'wikimedia/1', 2, 'UP', 'short', 'Why this shape?', '[]', 'they fit together tightly', '["they fit together tightly","to fit together with no gaps"]', '', 'sonnet'),
    ('drawn/bar_chart/1#1', 'drawn/bar_chart/1', 1, 'UP', 'short', 'How many mm?', '[]', '12', '["12","12 mm"]', '', 'code')`).run()
  db.close()
  return file
}

describe('publishing the library', () => {
  it('copies approved figures that reach a database topic, with only those links, and the questions a quiz can mark', () => {
    const [batch, ...rest] = [...stagingBatches(makeStore())]
    expect(rest).toEqual([])
    expect(batch.figures.map((f) => f.id)).toEqual(['drawn/bar_chart/1', 'wikimedia/1'])
    expect(batch.figures[0]).toMatchObject({ asset: 'assets/drawn/bar_chart/1.svg', shows: 'bar chart: Rain', topic: 'Cells', book: 'IGCSE Biology', books: '77', credit: null })
    expect(batch.figures[1]).toMatchObject({ shows: 'Onion cells', credit: 'By A, CC BY 4.0' })
    expect(batch.topics).toEqual([{ topic_id: 2, figure_id: 'drawn/bar_chart/1' }, { topic_id: 2, figure_id: 'wikimedia/1' }])
    // The open-phrase short answer is dropped, as the quiz drops it: it is marked by exact match.
    expect(batch.questions.map((q) => q.id)).toEqual(['drawn/bar_chart/1#1', 'wikimedia/1#1'])
    expect(batch.questions[1]).toMatchObject({ kind: 'mcq', options: '["Nucleus","Wall"]', answer: '0' })
  })

  it('splits into batches of the given size', () => {
    expect([...stagingBatches(makeStore(), 1)].map((b) => b.figures.length)).toEqual([1, 1])
  })

  it('writes a batch in one transaction, adding only what is new, and rolls back on error', async () => {
    const batch = [...stagingBatches(makeStore())][0]
    const sqls: string[] = []
    const ok = { query: async (sql: string) => { sqls.push(sql.trim().split(/\s+/).slice(0, 3).join(' ')); return { rows: [] } as never } }
    await writeBatch(ok, batch)
    expect(sqls).toEqual(['BEGIN', 'INSERT INTO figure_library', 'INSERT INTO figure_library_topics', 'INSERT INTO figure_library_questions', 'COMMIT'])

    const seen: string[] = []
    const failing = { query: async (sql: string) => { seen.push(sql.trim().split(/\s+/)[0]); if (sql.includes('figure_library_topics')) throw new Error('x'); return { rows: [] } as never } }
    await expect(writeBatch(failing, batch)).rejects.toThrow('x')
    expect(seen.at(-1)).toBe('ROLLBACK')
  })

  it('never updates or deletes: every insert does nothing on conflict', async () => {
    const batch: PublishBatch = [...stagingBatches(makeStore())][0]
    const full: string[] = []
    await writeBatch({ query: async (sql: string) => { full.push(sql); return { rows: [] } as never } }, batch)
    const inserts = full.filter((s) => s.includes('INSERT'))
    expect(inserts).toHaveLength(3)
    for (const s of inserts) expect(s).toMatch(/ON CONFLICT DO NOTHING/)
    expect(full.join(' ')).not.toMatch(/\b(UPDATE|DELETE)\b/)
  })
})
