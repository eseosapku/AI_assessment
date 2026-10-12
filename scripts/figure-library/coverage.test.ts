// scripts/figure-library/coverage.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { coverage } from './coverage'

describe('coverage', () => {
  it('counts approved figures per topic, their sources, and the largest share', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'B', 'biology', 'UP', 'Cells')").run()
    const add = (id: string, origin: string, family: string | null, status = 'approved') => {
      db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, status, created_at) VALUES (?, ?, ?, 'k', 'biology', 'UP', 'a', ?, 'now')`).run(id, origin, family, status)
      db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(id)
    }
    add('d1', 'drawn', 'punnett'); add('d2', 'drawn', 'punnett'); add('d3', 'drawn', 'punnett'); add('w1', 'wikimedia', null); add('w2', 'wikimedia', null, 'rejected')
    expect(coverage(db)).toEqual({
      topics: [{ key: 'db:2', name: 'Cells', approved: 4, sources: 2, largestShare: 0.75 }],
      totals: { approved: 4, drawn: 3, real: 1, topicsCovered: 1 },
    })
  })

  it('is empty, not broken, on a store with nothing approved', () => {
    expect(coverage(openStore(':memory:'))).toEqual({ topics: [], totals: { approved: 0, drawn: 0, real: 0, topicsCovered: 0 } })
  })
})
