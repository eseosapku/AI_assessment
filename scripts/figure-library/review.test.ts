// scripts/figure-library/review.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore, type Store } from './store'
import {
  PASS_MARK, REVIEW_SIZE, agrees, familyScores, itemsToReview, notedPasses, parseVerdict, previewImage, regrade, reviewPrompt,
  saveVerdict,
  type ReviewItem, type ReviewQuestion,
} from './review'

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:410', 'rwanda', 'Book', 'mathematics', 'LS', 'Statistics')").run()
  return db
}

function addFigure(db: Store, family: string, seed: number): string {
  const id = `drawn/${family}/${seed}`
  db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, seed, spec, status, created_at)
    VALUES (?, 'drawn', ?, 'graph.bar', 'mathematics', 'LS', ?, ?, ?, '{}', 'stored', 'now')`).run(id, family, `assets/${id}.svg`, `assets/${id}.png`, seed)
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model)
    VALUES (?, ?, 1, 'LS', 'mcq', 'Which fruit was most popular?', '["Mango","Apple","Orange"]', '0', '[]', 'code')`).run(`${id}#1`, id)
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model)
    VALUES (?, ?, 2, 'LS', 'short', 'How many students were asked?', '[]', '40', '["40","40 students"]', 'code')`).run(`${id}#2`, id)
  return id
}

const item: ReviewItem = {
  figureId: 'drawn/bar_chart/1', family: 'bar_chart', subject: 'mathematics', band: 'LS', preview: 'assets/drawn/bar_chart/1.png',
  questions: [
    { n: 1, kind: 'mcq', stem: 'Which fruit was most popular?', options: ['Mango', 'Apple', 'Orange'], answer: '0', accepted: [] },
    { n: 2, kind: 'short', stem: 'How many students were asked?', options: [], answer: '40', accepted: ['40', '40 students'] },
  ],
}

const good = {
  questions: [
    { n: 1, worked: 'The mango bar is tallest', own_answer: 'A', answerable: true, single_answer: true, problem: '' },
    { n: 2, worked: '12 + 10 + 18', own_answer: '40', answerable: true, single_answer: true, problem: '' },
  ],
  figure_clear: true, educational: true, problems: [],
}

const answering = (n: number, change: Record<string, unknown>) =>
  ({ ...good, questions: good.questions.map((q) => (q.n === n ? { ...q, ...change } : q)) })

const short = (answer: string, accepted: string[] = [answer]): ReviewQuestion =>
  ({ n: 1, kind: 'short', stem: 's', options: [], answer, accepted })

describe('the blind review prompt', () => {
  it('shows every question with its options lettered, and no answer key', () => {
    // The reviewer answers first; code compares with the key, so the key cannot anchor it.
    const p = reviewPrompt(item)
    expect(p).toContain('A) Mango')
    expect(p).toContain('How many students were asked?')
    expect(p).toContain('Lower Secondary')
    expect(p).not.toMatch(/\bkey\b|40 students/i)
  })

  it('does not say where the figure came from', () => {
    // Spec 5.5: the reviewer cannot see where an item came from.
    expect(reviewPrompt(item)).not.toMatch(/bar_chart|drawn|generated|\bcode\b|seed|family/i)
  })
})

describe('reading a verdict', () => {
  it('passes only when the reviewer reaches every key and the figure is sound', () => {
    expect(parseVerdict(good, item).pass).toBe(true)
    expect(parseVerdict(answering(1, { own_answer: 'B' }), item).pass).toBe(false)
    expect(parseVerdict(answering(2, { own_answer: '38' }), item).pass).toBe(false)
    expect(parseVerdict({ ...good, figure_clear: false }, item).pass).toBe(false)
  })

  it('fails a question with more than one right answer, even when the key is among them', () => {
    expect(parseVerdict(answering(1, { single_answer: false }), item).pass).toBe(false)
  })

  it('works the pass out itself, whatever the reviewer claims', () => {
    expect(parseVerdict({ ...good, pass: true, educational: false }, item).pass).toBe(false)
  })

  it('refuses a reply that skips a question, an answer or a judgement', () => {
    expect(() => parseVerdict({ ...good, questions: [good.questions[0]] }, item)).toThrow(/question 2/)
    expect(() => parseVerdict({ questions: good.questions }, item)).toThrow(/figure_clear/)
    expect(() => parseVerdict(answering(2, { answerable: 'yes' }), item)).toThrow(/question 2/)
    expect(() => parseVerdict(answering(2, { own_answer: '' }), item)).toThrow(/question 2/)
    expect(() => parseVerdict(answering(1, { single_answer: undefined }), item)).toThrow(/question 1/)
    expect(() => parseVerdict(null, item)).toThrow()
  })
})

describe('whether the reviewer reached the key', () => {
  it('reads a multiple-choice answer as a letter or as the option itself', () => {
    const q = item.questions[0]
    for (const own of ['A', 'a', 'A) Mango', '(A)', 'A. Mango', 'Mango']) expect(agrees(q, own), own).toBe(true)
    for (const own of ['B', 'Apple', 'C) Orange']) expect(agrees(q, own), own).toBe(false)
  })

  it('compares numbers, whatever the units or form', () => {
    expect(agrees(short('40', ['40', '40 students']), '40 students')).toBe(true)
    expect(agrees(short('40'), '40.0')).toBe(true)
    expect(agrees(short('9/25'), '0.36')).toBe(true)
    expect(agrees(short('9/25'), '18/50')).toBe(true)
    expect(agrees(short('07:30'), '7:30')).toBe(true)
    expect(agrees(short('3.4'), '3.6')).toBe(false)
    expect(agrees(short('40'), '38')).toBe(false)
    // A reviewer restating its answer in another form is one answer, not two.
    expect(agrees(short('0.1'), '1/10 (0.1)')).toBe(true)
    expect(agrees(short('0.1'), '0.1 or 0.2')).toBe(false)
  })

  it('compares words without case, a leading "the" or a full stop', () => {
    expect(agrees(short('Market'), 'the market.')).toBe(true)
    expect(agrees(short('Room 13', ['Room 13', '13']), 'room 13')).toBe(true)
    expect(agrees(short('Market'), 'Hospital')).toBe(false)
  })
})

describe('choosing figures to review', () => {
  it('takes the earliest seeds of each family, and skips any already reviewed', () => {
    const db = store()
    for (let s = 1; s <= 4; s++) addFigure(db, 'bar_chart', s)
    addFigure(db, 'pie_chart', 1)
    saveVerdict(db, { job: 'j', model: 'm', figureId: 'drawn/bar_chart/1', verdict: parseVerdict(good, item) })
    const items = itemsToReview(db, { job: 'j', size: 3 })
    expect(items.map((i) => i.figureId)).toEqual(['drawn/bar_chart/2', 'drawn/bar_chart/3', 'drawn/pie_chart/1'])
    expect(items[0].questions[1]).toEqual({ n: 2, kind: 'short', stem: 'How many students were asked?', options: [], answer: '40', accepted: ['40', '40 students'] })
  })

  it('keeps to the families asked for', () => {
    const db = store()
    addFigure(db, 'bar_chart', 1)
    addFigure(db, 'pie_chart', 1)
    expect(itemsToReview(db, { job: 'j', size: 30, families: ['pie_chart'] }).map((i) => i.figureId)).toEqual(['drawn/pie_chart/1'])
  })
})

describe('recording a verdict', () => {
  it('rejects a failed figure, with the reviewer reasons', () => {
    const db = store()
    const id = addFigure(db, 'bar_chart', 1)
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: parseVerdict(answering(2, { own_answer: '38', problem: 'the bars add to 38' }), item) })
    const f = db.prepare('SELECT status, reason FROM figures WHERE id = ?').get(id) as { status: string; reason: string }
    expect(f.status).toBe('rejected')
    expect(f.reason).toContain('Q2: the reviewer answered "38", the key is 40: the bars add to 38')
  })

  it('keeps one verdict per figure per job, the latest', () => {
    const db = store()
    const id = addFigure(db, 'bar_chart', 1)
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: parseVerdict({ ...good, figure_clear: false }, item) })
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: parseVerdict(good, item) })
    expect(db.prepare('SELECT COUNT(*) AS n, MAX(pass) AS p FROM reviews').get()).toEqual({ n: 1, p: 1 })
    expect(db.prepare('SELECT status, reason FROM figures WHERE id = ?').get(id)).toEqual({ status: 'stored', reason: null })
  })

  it('lists the passes whose reviewer still wrote a concern, for a person to read', () => {
    const db = store()
    const a = addFigure(db, 'bar_chart', 1)
    const b = addFigure(db, 'bar_chart', 2)
    saveVerdict(db, { job: 'j', model: 'm', figureId: a, verdict: parseVerdict(good, item) })
    saveVerdict(db, { job: 'j', model: 'm', figureId: b, verdict: parseVerdict({ ...good, problems: ['the labels are small'] }, item) })
    expect(notedPasses(db, 'j')).toEqual([{ figureId: b, notes: 'the labels are small' }])
  })
})

describe('regrading', () => {
  it('recomputes stored verdicts under the current rules, sending nothing', () => {
    // A verdict saved before agrees() read "1/10 (0.1)" as one answer is put right without paying again.
    const db = store()
    const id = addFigure(db, 'bar_chart', 1)
    const old = parseVerdict(good, item)
    const stale = { ...old, pass: false, questions: old.questions.map((q) => (q.n === 2 ? { ...q, ownAnswer: '40 (forty)', keyCorrect: false } : q)) }
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: stale })
    expect(db.prepare('SELECT status FROM figures WHERE id = ?').get(id)).toEqual({ status: 'rejected' })
    expect(regrade(db, 'j')).toBe(1)
    expect(db.prepare('SELECT pass FROM reviews').get()).toEqual({ pass: 1 })
    expect(db.prepare('SELECT status FROM figures WHERE id = ?').get(id)).toEqual({ status: 'stored' })
    expect(regrade(db, 'j')).toBe(0)
  })
})

describe('family scores', () => {
  it('passes a family at 27 of 30, not below, and not before 30 are reviewed', () => {
    const db = store()
    const fill = (family: string, n: number, failures: number) => {
      for (let s = 1; s <= n; s++) {
        const id = addFigure(db, family, s)
        saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: { ...parseVerdict(good, item), pass: s > failures } })
      }
    }
    fill('a', 30, 3)
    fill('b', 30, 4)
    fill('c', 20, 0)
    expect(familyScores(db, 'j')).toEqual([
      { family: 'a', reviewed: 30, passed: 27, passes: true },
      { family: 'b', reviewed: 30, passed: 26, passes: false },
      { family: 'c', reviewed: 20, passed: 20, passes: false },
    ])
    expect([REVIEW_SIZE, PASS_MARK]).toEqual([30, 27])
  })
})

describe('the figure image for the reviewer', () => {
  it('is the PNG from the library folder', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-prev-'))
    fs.mkdirSync(path.join(lib, 'assets/drawn/bar_chart'), { recursive: true })
    fs.writeFileSync(path.join(lib, item.preview), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    expect(previewImage(lib, item)).toEqual({ mediaType: 'image/png', data: 'iVBORw==' })
  })

  it('is null when the file is missing, so nothing is sent or paid for', () => {
    expect(previewImage(os.tmpdir(), { preview: 'assets/none/0.png' })).toBeNull()
  })
})
