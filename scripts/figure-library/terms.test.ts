// scripts/figure-library/terms.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { parseTerms, saveTerms, termsPrompt, topicsForTerms } from './terms'

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1098', 'rwanda', 'Geography S1', 'geography', 'LS', 'Forms of relief')").run()
  for (const [k, n] of [['s1', 'Relief'], ['s2', 'Forms of relief']]) db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES (?, 'db:1098', ?)").run(k, n)
  return db
}

describe('search terms from the syllabus', () => {
  it('asks for diagrams and local photos, naming the syllabus points and where the learners are', () => {
    const [t] = topicsForTerms(store(), ['db:1098', 'db:none'])
    expect(t).toEqual({ key: 'db:1098', subject: 'geography', band: 'LS', source: 'rwanda', topic: 'Forms of relief', subtopics: ['Relief', 'Forms of relief'] })
    const p = termsPrompt(t)
    for (const part of ['Topic: Forms of relief.', 'Syllabus points: Relief; Forms of relief.', 'learners in Rwanda', 'labelled diagrams', 'East Africa']) expect(p).toContain(part)
  })

  it('keeps short distinct terms, and refuses a reply without enough diagrams', () => {
    expect(parseTerms({ diagrams: ['fold mountain diagram', 'Fold mountain diagram', 'rift valley diagram', 'plateau diagram', ''], photos: ['Virunga volcanoes', 'x'.repeat(80)] }))
      .toEqual({ diagrams: ['fold mountain diagram', 'rift valley diagram', 'plateau diagram'], photos: ['Virunga volcanoes'] })
    expect(() => parseTerms({ diagrams: ['a diagram'], photos: [] })).toThrow(/diagram/)
    expect(() => parseTerms(null)).toThrow()
  })

  it('stores the terms in search order, diagrams first, replacing earlier ones', () => {
    const db = store()
    saveTerms(db, 'db:1098', 'haiku', { diagrams: ['plateau diagram', 'rift valley diagram', 'fold mountain diagram'], photos: ['Virunga volcanoes'] })
    saveTerms(db, 'db:1098', 'haiku', { diagrams: ['plateau diagram', 'rift valley diagram', 'escarpment diagram'], photos: ['Lake Kivu', 'plateau diagram'] })
    expect(db.prepare('SELECT term, kind FROM search_terms ORDER BY rowid').all()).toEqual([
      { term: 'plateau diagram', kind: 'diagram' }, { term: 'rift valley diagram', kind: 'diagram' },
      { term: 'escarpment diagram', kind: 'diagram' }, { term: 'Lake Kivu', kind: 'photo' },
    ])
  })
})
