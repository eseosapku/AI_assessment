import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../../scripts/figure-library/store'
import { libraryEnabled, libraryFigures, toVetted } from './local-source'

function makeStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-src-'))
  const file = path.join(dir, 'figures.db')
  const db = openStore(file, process.cwd())
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:2', 'cambridge', 77, 'Cambridge IGCSE Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES ('db:9', 'cambridge', 77, 'Cambridge IGCSE Biology', 'biology', 'UP', 'Enzymes')").run()
  const fig = (id: string, origin: string, status: string, family: string | null, kind: string, credit: string | null, spec = '{}') => {
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, spec, credit, status, created_at)
      VALUES (?, ?, ?, ?, 'biology', 'UP', ?, ?, ?, ?, ?, 'now')`).run(id, origin, family, kind, `assets/${id}.webp`, `assets/${id}-512.jpg`, spec, credit, status)
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(id)
  }
  fig('wikimedia/1', 'wikimedia', 'approved', null, 'photo.micrograph', 'Onion cells by A, CC BY 4.0, via Wikimedia Commons')
  fig('wikimedia/2', 'wikimedia', 'screened', null, 'photo.micrograph', 'x')
  fig('drawn/punnett/1', 'drawn', 'approved', 'punnett', 'bio.genetics', null)
  fig('drawn/bar_chart/1', 'drawn', 'approved', 'bar_chart', 'graph.bar', null, '{"title": "How students travel to school"}')
  db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES ('wikimedia/1', 'm', 1, 'Onion epidermis cells with nuclei', '{}', 'now')").run()
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model) VALUES
    ('wikimedia/1#sonnet#1', 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dark dot?', '["Nucleus","Vacuole","Wall","Membrane"]', '0', '[]', 'It holds DNA.', 'sonnet'),
    ('wikimedia/1#sonnet#2', 'wikimedia/1', 2, 'UP', 'short', 'Why are the cells this shape?', '[]', 'they fit together tightly', '["they fit together tightly","to fit together with no gaps"]', '', 'sonnet'),
    ('drawn/punnett/1#1', 'drawn/punnett/1', 1, 'UP', 'short', 'What percentage are short?', '[]', '25%', '["25%","25"]', '', 'code')`).run()
  db.close()
  return file
}

describe('the local library source', () => {
  it('is off without both settings, as in production', () => {
    expect(libraryEnabled({})).toBe(false)
    expect(libraryEnabled({ FIGURE_LIBRARY_DIR: 'C:/lib' })).toBe(false)
    expect(libraryEnabled({ FIGURE_ASSET_BASE: '/api/figure-library/asset' })).toBe(false)
    expect(libraryEnabled({ FIGURE_LIBRARY_DIR: 'C:/lib', FIGURE_ASSET_BASE: '/x' })).toBe(true)
  })

  it('gives the approved figures of the quiz topics, shaped like bank figures, with their credit', () => {
    const { figures, questions } = libraryFigures({ topicIds: [2], file: makeStore(), base: '/api/figure-library/asset' })
    expect(figures.map((f) => f.id).sort()).toEqual(['lib:drawn/bar_chart/1', 'lib:drawn/punnett/1', 'lib:wikimedia/1'])
    const real = figures.find((f) => f.id === 'lib:wikimedia/1')!
    expect(real).toMatchObject({ source: 'wikimedia', textbookIds: [77], textbookName: 'Cambridge IGCSE Biology', topic: 'Cells', noun: 'micrograph',
      localPath: '/api/figure-library/asset/assets/wikimedia/1.webp', shows: 'Onion epidermis cells with nuclei',
      credit: 'Onion cells by A, CC BY 4.0, via Wikimedia Commons' })
    expect(figures.find((f) => f.id === 'lib:drawn/punnett/1')!.credit).toBeUndefined()
    expect(figures.find((f) => f.id === 'lib:drawn/bar_chart/1')!).toMatchObject({ source: 'bar_chart', noun: 'diagram', shows: 'bar chart: How students travel to school' })
    // The open-phrase short answer is dropped, as the bank drops it: it is marked by exact match.
    expect(questions.get('lib:wikimedia/1')).toEqual([{ kind: 'mcq', question: { type: 'mcq', question: 'What is the dark dot?',
      options: ['Nucleus', 'Vacuole', 'Wall', 'Membrane'], correct_answer: 0, explanation: 'It holds DNA.' } }])
  })

  it('gives nothing for other topics, and nothing when the store cannot be opened', () => {
    expect(libraryFigures({ topicIds: [9], file: makeStore(), base: '/x' }).figures).toEqual([])
    expect(libraryFigures({ topicIds: [2], file: path.join(os.tmpdir(), 'no-such-dir', 'figures.db'), base: '/x' }).figures).toEqual([])
  })

  it('converts a short answer to the bank format', () => {
    expect(toVetted({ kind: 'short', stem: 'What %?', options: '[]', answer: '25%', accepted: '["25%","25"]', explanation: '' }))
      .toEqual({ kind: 'short', question: { type: 'longform', question: 'What %?', marks: 1, short_answer: { accepted: ['25%', '25'] }, explanation: '' } })
  })
})
