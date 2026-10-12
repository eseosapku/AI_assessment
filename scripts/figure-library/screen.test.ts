// scripts/figure-library/screen.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { parseScreen, saveScreen, screenPrompt, toScreen, type ScreenItem } from './screen'

const item: ScreenItem = {
  figureId: 'wikimedia/1', subject: 'biology', band: 'UP', topic: 'Cells', title: 'File:Onion cells.jpg',
  description: 'Onion epidermis under a light microscope', preview: 'assets/wikimedia/1-512.jpg',
}
const good = { shows: 'Onion epidermis cells with nuclei', educational: true, on_topic: true, clear: true, person_is_subject: false, mostly_text: false, foreign_labels: false, decorative: false }

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')").run()
  for (const n of [1, 2]) {
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, preview, spec, licence, author, source_url, credit, status, created_at)
      VALUES (?, 'wikimedia', 'photo.micrograph', 'biology', 'UP', ?, ?, ?, 'CC BY 4.0', 'A', 'https://x', 'c', 'candidate', 'now')`)
      .run(`wikimedia/${n}`, `assets/wikimedia/${n}.webp`, `assets/wikimedia/${n}-512.jpg`, JSON.stringify({ title: `File:${n}.jpg`, description: 'cells' }))
    db.prepare("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, 'db:2')").run(`wikimedia/${n}`)
  }
  return db
}

describe('the screening prompt', () => {
  it('names the subject, level, topic and file, and asks every judgement', () => {
    const p = screenPrompt(item)
    for (const part of ['biology', 'Upper Secondary', '"Cells"', 'Onion cells.jpg', 'person_is_subject', 'foreign_labels', 'decorative']) expect(p).toContain(part)
  })
})

describe('reading a screening', () => {
  it('keeps an image only when every judgement is right', () => {
    expect(parseScreen(good)).toEqual({ keep: true, shows: 'Onion epidermis cells with nuclei', reasons: [] })
    expect(parseScreen({ ...good, person_is_subject: true })).toEqual({ keep: false, shows: good.shows, reasons: ['a person is the subject'] })
    expect(parseScreen({ ...good, clear: false, foreign_labels: true }).reasons).toEqual(['not clear enough', 'labels not in English'])
  })

  it('refuses a screening that leaves out a judgement', () => {
    const { decorative: _gone, ...partial } = good
    expect(() => parseScreen(partial)).toThrow(/decorative/)
    expect(() => parseScreen({ ...good, shows: '' })).toThrow(/shows/)
    expect(() => parseScreen(null)).toThrow()
  })
})

describe('screening in the store', () => {
  it('lists candidates not yet screened, and records each verdict once', () => {
    const db = store()
    expect(toScreen(db).map((i) => i.figureId)).toEqual(['wikimedia/1', 'wikimedia/2'])
    expect(toScreen(db)[0]).toMatchObject({ topic: 'Cells', title: 'File:1.jpg', preview: 'assets/wikimedia/1-512.jpg' })
    saveScreen(db, { figureId: 'wikimedia/1', model: 'nova', screening: parseScreen(good), detail: good })
    saveScreen(db, { figureId: 'wikimedia/2', model: 'nova', screening: parseScreen({ ...good, educational: false }), detail: {} })
    expect(toScreen(db)).toEqual([])
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/1'").get()).toEqual({ status: 'screened', reason: null })
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/2'").get()).toEqual({ status: 'rejected', reason: 'not educational' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM screenings').get()).toEqual({ n: 2 })
  })
})
