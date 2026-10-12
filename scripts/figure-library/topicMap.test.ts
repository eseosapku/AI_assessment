// scripts/figure-library/topicMap.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { FIGURE_KINDS } from './figureKinds'
import type { Concept } from './concepts'
import { MAX_SUBTOPICS, conceptsForBand, estimateMapUsd, parseTopicMap, saveTopicMap, topicPrompt, topicsToMap } from './topicMap'

const concepts: Concept[] = [
  { id: 'geography.rivers', subject: 'geography', name: 'Rivers', bands: ['LS', 'UP'], aliases: [] },
  { id: 'geography.climate', subject: 'geography', name: 'Climate', bands: ['UP'], aliases: [] },
]
const valid = { concepts: new Set(concepts.map((c) => c.id)), kinds: new Set(FIGURE_KINDS.map((k) => k.id)) }

describe('the topic prompt', () => {
  it('lists subtopics by number, or says there are none', () => {
    // Every NERDC, WAEC, JAMB and Checkpoint topic has no subtopics.
    const withSubs = topicPrompt({ subject: 'geography', band: 'LS', book: 'Geography S2', name: 'Rivers', subtopics: ['Erosion', 'Deposition'] }, concepts, FIGURE_KINDS)
    expect(withSubs).toContain('0. Erosion\n1. Deposition')
    expect(withSubs).toContain('rivers: Rivers')
    expect(withSubs).toContain('physics.circuit: Electrical circuit diagram (drawn)')
    const none = topicPrompt({ subject: 'geography', band: 'UP', book: 'WAEC Geography', name: 'Rivers', subtopics: [] }, concepts, FIGURE_KINDS)
    expect(none).toContain('SUBTOPICS: none')
  })
  it('asks for kinds that genuinely fit and search terms a question can be asked about', () => {
    // The trial padded an accounting topic with a labelled-diagram template and
    // probability diagrams, and searched for "tax office building".
    const p = topicPrompt({ subject: 'accounting', band: 'UP', book: 'B', name: 'Taxation', subtopics: [] }, concepts, FIGURE_KINDS)
    expect(p).toMatch(/Do not pad/)
    expect(p).not.toMatch(/Aim for 6 to 15/)
    expect(p).toMatch(/Never buildings, offices/)
  })

  it('sends at most 60 subtopics', () => {
    const many = Array.from({ length: 70 }, (_, i) => `Sub ${i}`)
    const p = topicPrompt({ subject: 'geography', band: 'LS', book: 'B', name: 'T', subtopics: many }, concepts, FIGURE_KINDS)
    expect(p).toContain(`${MAX_SUBTOPICS - 1}. Sub ${MAX_SUBTOPICS - 1}`)
    expect(p).not.toContain(`${MAX_SUBTOPICS}. Sub ${MAX_SUBTOPICS}`)
  })
  it('narrows concepts to the topic level only when enough remain', () => {
    expect(conceptsForBand(concepts, 'LS')).toEqual(concepts)
  })
})

describe('parsing a topic plan', () => {
  it('keeps valid ids, counts the ones it dropped, and cleans search terms', () => {
    const map = parseTopicMap({
      concepts: ['rivers', 'geography.climate', 'made-up'],
      kinds: ['geo.section', 'photo.landscape', 'not-a-kind'],
      terms: ['Oxbow Lake aerial', 'oxbow lake aerial', 'x'],
      visual: 'high',
      subtopics: [{ i: 0, concepts: ['rivers'], kinds: ['geo.section'] }, { i: 9, concepts: ['rivers'], kinds: [] }],
    }, 'geography', valid, 2)
    expect(map).toEqual({
      concepts: ['geography.rivers', 'geography.climate'],
      kinds: ['geo.section', 'photo.landscape'],
      terms: ['oxbow lake aerial'],
      visual: 'high',
      subtopics: [{ concepts: ['geography.rivers'], kinds: ['geo.section'] }, { concepts: [], kinds: [] }],
      dropped: 2,
    })
  })
  it('expects no subtopics for a topic that has none', () => {
    const map = parseTopicMap({ concepts: ['rivers'], kinds: ['geo.map'], terms: [], visual: 'medium', subtopics: [] }, 'geography', valid, 0)
    expect(map?.subtopics).toEqual([])
  })
  it('refuses a plan with no valid concept or no valid kind', () => {
    expect(parseTopicMap({ concepts: ['made-up'], kinds: ['geo.map'] }, 'geography', valid, 0)).toBeNull()
    expect(parseTopicMap({ concepts: ['rivers'], kinds: ['nope'] }, 'geography', valid, 0)).toBeNull()
    expect(parseTopicMap(null, 'geography', valid, 0)).toBeNull()
  })
})

describe('resuming a run', () => {
  it('maps only topics that have no plan yet', () => {
    const db = openStore(':memory:')
    for (const k of ['db:1', 'db:2', 'db:3']) {
      db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'Geography S2', 'geography', 'LS', ?)").run(k, `Topic ${k}`)
    }
    db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('db:100', 'db:1', 'Erosion')").run()
    saveTopicMap(db, 'db:1', ['db:100'], { concepts: ['geography.rivers'], kinds: ['geo.map'], terms: [], visual: 'high', subtopics: [{ concepts: [], kinds: ['geo.map'] }], dropped: 0 }, 'test')
    expect(topicsToMap(db, {}).map((t) => t.key)).toEqual(['db:2', 'db:3'])
    expect(topicsToMap(db, { limit: 1 }).map((t) => t.key)).toEqual(['db:2'])
    expect(topicsToMap(db, { redo: true }).map((t) => t.key)).toEqual(['db:1', 'db:2', 'db:3'])
    expect((db.prepare("SELECT kinds FROM subtopic_map WHERE subtopic_key = 'db:100'").get() as { kinds: string }).kinds).toBe('["geo.map"]')
  })
})

describe('estimating a mapping run', () => {
  it('prices each topic from its own prompt and subtopic count, not a flat guess', () => {
    // The flat 4,500-in / 700-out guess refused a run the trial showed would
    // cost about 60% of it (2,319 in and 513 out on average).
    expect(estimateMapUsd(8000, 5)).toBeCloseTo((Math.ceil(8000 / 3.5) * 1.1 + (300 + 45 * 5) * 5.5) / 1e6, 9)
    expect(estimateMapUsd(8000, 90)).toBeCloseTo(estimateMapUsd(8000, 60), 12)
  })
})

describe('rechecking a topic mapped to few kinds', () => {
  it('shows the kinds it got before and asks for every kind that genuinely fits', () => {
    // 85 topics (mostly Art and Music) got one or two kinds; some were mapped narrowly.
    const p = topicPrompt({ subject: 'geography', band: 'LS', book: 'B', name: 'Rivers', subtopics: [] }, concepts, FIGURE_KINDS, ['geo.map'])
    expect(p).toMatch(/mapped before to only: geo\.map/)
    expect(p).toMatch(/every kind that genuinely fits/)
    expect(p).toMatch(/Do not pad/)
  })

  it('selects topics by key, including mapped ones when asked to redo', () => {
    const db = openStore(':memory:')
    for (const k of ['db:1', 'db:2', 'db:3']) {
      db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'B', 'geography', 'LS', ?)").run(k, `Topic ${k}`)
    }
    saveTopicMap(db, 'db:2', [], { concepts: ['geography.rivers'], kinds: ['geo.map'], terms: [], visual: 'high', subtopics: [], dropped: 0 }, 'test')
    expect(topicsToMap(db, { keys: ['db:2', 'db:3'] }).map((t) => t.key)).toEqual(['db:3'])
    expect(topicsToMap(db, { keys: ['db:2', 'db:3'], redo: true }).map((t) => t.key)).toEqual(['db:2', 'db:3'])
  })
})
