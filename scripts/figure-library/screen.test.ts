// scripts/figure-library/screen.test.ts
import { describe, it, expect } from 'vitest'
import { openStore, type Store } from './store'
import { parseScreen, regradeScreens, resetScreens, saveScreen, screenPrompt, toScreen, type ScreenItem } from './screen'

const item: ScreenItem = {
  figureId: 'wikimedia/1', subject: 'biology', band: 'UP', topic: 'Cells', title: 'File:Onion cells.jpg',
  description: 'Onion epidermis under a light microscope', preview: 'assets/wikimedia/1-512.jpg',
  subtopics: ['Animal and plant cells', 'Specialised cells'],
}
const good = { shows: 'Onion epidermis cells with nuclei', image_type: 'micrograph', topic_fit: 'a light micrograph of plant cells', educational: true, in_syllabus: true, clear: true, beyond_level: false, unfamiliar_example: false, person_is_subject: false, mostly_text: false, foreign_labels: false, decorative: false }

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')").run()
  db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('s1', 'db:2', 'Animal and plant cells')").run()
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
    for (const part of ['biology', 'Upper Secondary', '"Cells"', 'Onion cells.jpg', 'Syllabus points: Animal and plant cells; Specialised cells.', 'in_syllabus', 'unfamiliar_example', 'image_type', 'beyond_level', 'research paper', 'person_is_subject', 'foreign_labels', 'decorative']) expect(p).toContain(part)
  })
})

describe('the reply the screener is shown', () => {
  it('carries no values to copy', () => {
    // Nova Lite copied the example reply verbatim: 599 of 600 kept, a Buffalo office
    // block "on topic" for the Cold War. The template now holds only placeholders.
    const p = screenPrompt(item)
    expect(p).not.toMatch(/"(?:educational|in_syllabus|clear|beyond_level|unfamiliar_example|person_is_subject|mostly_text|foreign_labels|decorative)":\s*(?:true|false)/)
    expect(p).toContain('"educational": boolean')
    expect(p.indexOf('topic_fit')).toBeLessThan(p.indexOf('"educational"'))
  })
})

describe('reading a screening', () => {
  it('keeps an image only when every judgement is right', () => {
    expect(parseScreen(good)).toEqual({ keep: true, shows: 'Onion epidermis cells with nuclei', reasons: [], type: 'micrograph' })
    expect(parseScreen({ ...good, person_is_subject: true })).toEqual({ keep: false, shows: good.shows, reasons: ['a person is the subject'], type: 'micrograph' })
    expect(parseScreen({ ...good, clear: false, foreign_labels: true }).reasons).toEqual(['not clear enough', 'labels not in English'])
    // Commons' openly licensed micrographs are mostly research-paper figures: beyond any school level.
    expect(parseScreen({ ...good, beyond_level: true }).reasons).toEqual(['beyond this level'])
  })

  it('rejects what the syllabus does not cover and distant examples, and records the image type', () => {
    expect(parseScreen({ ...good, in_syllabus: false }).reasons).toEqual(['not in the syllabus'])
    expect(parseScreen({ ...good, unfamiliar_example: true }).reasons).toEqual(['an unfamiliar example'])
    expect(parseScreen({ ...good, image_type: 'Diagram' }).type).toBe('diagram')
    expect(parseScreen({ ...good, image_type: 'painting' }).type).toBe('other')
    expect(() => parseScreen({ ...good, in_syllabus: undefined })).toThrow(/in_syllabus/)
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
    expect(toScreen(db)[0]).toMatchObject({ topic: 'Cells', title: 'File:1.jpg', preview: 'assets/wikimedia/1-512.jpg', subtopics: ['Animal and plant cells'] })
    saveScreen(db, { figureId: 'wikimedia/1', model: 'nova', screening: parseScreen(good), detail: good })
    saveScreen(db, { figureId: 'wikimedia/2', model: 'nova', screening: parseScreen({ ...good, educational: false }), detail: {} })
    expect(toScreen(db)).toEqual([])
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/1'").get()).toEqual({ status: 'screened', reason: null })
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/2'").get()).toEqual({ status: 'rejected', reason: 'not educational' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM screenings').get()).toEqual({ n: 2 })
  })
})

describe('screening again', () => {
  it('puts every real image back to be screened, and leaves drawn figures alone', () => {
    const db = store()
    db.prepare(`INSERT INTO figures (id, origin, kind, subject, band, asset, status, created_at)
      VALUES ('drawn/x/1', 'drawn', 'graph.bar', 'mathematics', 'LS', 'a.svg', 'rejected', 'now')`).run()
    saveScreen(db, { figureId: 'wikimedia/1', model: 'nova', screening: parseScreen(good), detail: good })
    saveScreen(db, { figureId: 'wikimedia/2', model: 'nova', screening: parseScreen({ ...good, educational: false }), detail: {} })
    expect(resetScreens(db)).toBe(2)
    expect(toScreen(db).map((i) => i.figureId)).toEqual(['wikimedia/1', 'wikimedia/2'])
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/2'").get()).toEqual({ status: 'candidate', reason: null })
    expect(db.prepare("SELECT status FROM figures WHERE id = 'drawn/x/1'").get()).toEqual({ status: 'rejected' })
  })
})

describe('distant examples', () => {
  // The screener rejected a bee showing insect features and a dissected flower showing its
  // parts as "unfamiliar": what an organism or object shows is the same anywhere. Only a
  // place or a case, in geography or history, is held to the learners' world.
  it('count only against places and cases, in geography and history', () => {
    const distant = { ...good, unfamiliar_example: true }
    expect(parseScreen(distant, 'biology').keep).toBe(true)
    expect(parseScreen(distant, 'chemistry').keep).toBe(true)
    expect(parseScreen(distant, 'geography').reasons).toEqual(['an unfamiliar example'])
    expect(parseScreen(distant, 'history').keep).toBe(false)
    expect(parseScreen(distant).keep).toBe(false)
  })

  it('are regraded from the stored judgements, without screening again', () => {
    const db = store()
    saveScreen(db, { figureId: 'wikimedia/1', model: 'm', screening: parseScreen({ ...good, unfamiliar_example: true }), detail: { ...good, unfamiliar_example: true } })
    saveScreen(db, { figureId: 'wikimedia/2', model: 'm', screening: parseScreen({ ...good, clear: false }), detail: { ...good, clear: false } })
    expect(regradeScreens(db)).toBe(1)
    expect(db.prepare("SELECT status, reason FROM figures WHERE id = 'wikimedia/1'").get()).toEqual({ status: 'screened', reason: null })
    expect(db.prepare("SELECT keep FROM screenings WHERE figure_id = 'wikimedia/1'").get()).toEqual({ keep: 1 })
    expect(db.prepare("SELECT status FROM figures WHERE id = 'wikimedia/2'").get()).toEqual({ status: 'rejected' })
    expect(regradeScreens(db)).toBe(0)
  })
})
