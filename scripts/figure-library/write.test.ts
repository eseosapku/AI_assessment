// scripts/figure-library/write.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { HAIKU, SONNET } from './claude'
import { checkPrompt, clearWritten, parseChecked, parseWritten, saveWritten, toWrite, writePrompt, writerTag, type WriteItem } from './write'

const item: WriteItem = { figureId: 'wikimedia/1', subject: 'biology', band: 'UP', topic: 'Cells', shows: 'Onion epidermis cells with nuclei', image: 'assets/wikimedia/1.webp', subtopics: ['Animal and plant cells', 'Specialised cells'] }
const mcq = { kind: 'mcq', stem: 'Look at the micrograph. What is the dark dot in each cell?', options: ['Nucleus', 'Vacuole', 'Chloroplast', 'Cell wall'], answer: 0, explanation: 'It holds the DNA.' }
const short = { kind: 'short', stem: 'Look at the micrograph. What surrounds each plant cell?', answer: 'cell wall', accepted: ['a cell wall', 'cell wall'], explanation: '' }

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('s1', 'db:2', 'Animal and plant cells')").run()
  for (const [n, keep] of [[1, 1], [2, 1], [3, 0]] as const) {
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, preview, spec, status, created_at)
      VALUES (?, 'wikimedia', 'photo.micrograph', 'biology', 'UP', ?, ?, '{}', ?, 'now')`).run(`wikimedia/${n}`, `assets/wikimedia/${n}.webp`, `assets/wikimedia/${n}-512.jpg`, keep ? 'screened' : 'rejected')
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(`wikimedia/${n}`)
    db.prepare("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES (?, 'nova', ?, 'cells', '{}', 'now')").run(`wikimedia/${n}`, keep)
  }
  return db
}

describe('the writing prompt', () => {
  it('sets the subject, level, topic and what the image shows, and the house rules', () => {
    const p = writePrompt(item)
    for (const part of ['biology', 'Upper Secondary', 'Topic: Cells.', 'Syllabus points: Animal and plant cells; Specialised cells.', 'Ask only what these syllabus points teach', 'Onion epidermis cells with nuclei', 'never the answer', 'four options', 'at most four words', '{"questions": []}']) expect(p).toContain(part)
  })
})

describe('reading what was written', () => {
  it('keeps well-formed questions, with the options in a seeded order', () => {
    const { questions, refused } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    expect(refused).toEqual([])
    const [m, s] = questions
    expect(m.options[Number(m.answer)]).toBe('Nucleus')
    expect([...m.options].sort()).toEqual(['Cell wall', 'Chloroplast', 'Nucleus', 'Vacuole'])
    expect(parseWritten({ questions: [mcq] }, 'wikimedia/1').questions[0]).toEqual(m)  // the same order every time
    expect(s).toEqual({ kind: 'short', stem: short.stem, options: [], answer: 'cell wall', accepted: ['cell wall', 'a cell wall'], explanation: '' })
  })

  it('refuses malformed questions and says why', () => {
    const { questions, refused } = parseWritten({ questions: [
      { ...mcq, options: ['A', 'A', 'B', 'C'] }, { ...mcq, answer: 4 }, { ...short, answer: 'the wall around the cell' }, { ...short, kind: 'essay' }, { ...mcq, stem: '' },
    ] }, 'x')
    expect(questions).toEqual([])
    expect(refused).toHaveLength(3)  // only the first three are read
  })

  it('accepts an image with no good question, and refuses a reply with no list', () => {
    expect(parseWritten({ questions: [] }, 'x')).toEqual({ questions: [], refused: [] })
    expect(() => parseWritten({}, 'x')).toThrow(/questions/)
  })
})

describe('the check', () => {
  it('shows each question with its key', () => {
    const { questions } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    const p = checkPrompt(item, questions)
    expect(p).toContain(`Key: ${String.fromCharCode(65 + Number(questions[0].answer))}`)
    expect(p).toContain('Key: cell wall (also accepted: a cell wall)')
  })

  it('reads a verdict for every question, and refuses a check that skips a question', () => {
    expect(parseChecked({ verdicts: [{ n: 1, keep: true }, { n: 2, keep: false, reason: 'not visible' }] }, 2))
      .toEqual([{ keep: true, reason: '' }, { keep: false, reason: 'not visible' }])
    expect(() => parseChecked({ verdicts: [{ n: 1, keep: true }] }, 2)).toThrow(/question 2/)
    expect(() => parseChecked({ verdicts: [{ n: 1, keep: 'yes' }] }, 1)).toThrow(/question 1/)
  })
})

describe('writing in the store', () => {
  it('lists kept images not yet written by this writer, and saves only kept questions', () => {
    const db = store()
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/1', 'wikimedia/2'])
    const { questions } = parseWritten({ questions: [mcq, short] }, 'wikimedia/1')
    expect(saveWritten(db, { figureId: 'wikimedia/1', writer: HAIKU, band: 'UP', questions, checks: [{ keep: true, reason: '' }, { keep: false, reason: 'not visible' }] })).toBe(1)
    expect(db.prepare('SELECT id, n, kind, model FROM figure_questions').all()).toEqual([{ id: 'wikimedia/1#haiku#1', n: 1, kind: 'mcq', model: HAIKU }])
    expect(db.prepare('SELECT question_id, keep, reason FROM question_checks ORDER BY question_id').all())
      .toEqual([{ question_id: 'wikimedia/1#haiku#1', keep: 1, reason: '' }, { question_id: 'wikimedia/1#haiku#2', keep: 0, reason: 'not visible' }])
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/2'])
    expect(toWrite(db, { writer: SONNET, figureIds: ['wikimedia/1'] }).map((i) => i.figureId)).toEqual(['wikimedia/1'])
  })

  it('does not write twice for the same writer, even when the image got no question', () => {
    const db = store()
    saveWritten(db, { figureId: 'wikimedia/2', writer: HAIKU, band: 'UP', questions: [], checks: [], refused: ['Q1: kind must be mcq or short'] })
    expect(db.prepare("SELECT question_id, keep, reason FROM question_checks").get())
      .toEqual({ question_id: 'wikimedia/2#haiku#0', keep: 0, reason: 'Q1: kind must be mcq or short' })
    expect(toWrite(db, { writer: HAIKU }).map((i) => i.figureId)).toEqual(['wikimedia/1'])
  })

  it('names each writer', () => {
    expect([writerTag(HAIKU), writerTag(SONNET), writerTag('other')]).toEqual(['haiku', 'sonnet', 'model'])
  })
})

describe('the syllabus in writing', () => {
  it('tells the checker the syllabus points', () => {
    const { questions } = parseWritten({ questions: [mcq] }, 'wikimedia/1')
    expect(checkPrompt(item, questions)).toContain('it tests something these syllabus points teach')
  })

  it('reads each image with its syllabus points', () => {
    expect(toWrite(store(), { writer: HAIKU })[0].subtopics).toEqual(['Animal and plant cells'])
  })

  it('clears real-image questions only, before a new round', () => {
    const db = store()
    const { questions } = parseWritten({ questions: [mcq] }, 'wikimedia/1')
    saveWritten(db, { figureId: 'wikimedia/1', writer: HAIKU, band: 'UP', questions, checks: [{ keep: true, reason: '' }] })
    db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, status, created_at) VALUES ('drawn/x/1', 'drawn', 'x', 'graph.bar', 'biology', 'UP', 'a.svg', 'stored', 'now')`).run()
    db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, answer, model) VALUES ('drawn/x/1#1', 'drawn/x/1', 1, 'UP', 'short', 's', '1', 'code')`).run()
    expect(clearWritten(db)).toBe(1)
    expect(db.prepare('SELECT id FROM figure_questions').all()).toEqual([{ id: 'drawn/x/1#1' }])
    expect(db.prepare('SELECT COUNT(*) AS n FROM question_checks').get()).toEqual({ n: 0 })
  })
})
