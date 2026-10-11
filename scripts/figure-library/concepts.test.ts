// scripts/figure-library/concepts.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { applyMerges, chunk, coarsenTarget, conceptPrompt, consolidationPrompt, loadConcepts, mappedTopicCount, mergeConcepts, namesWithBands, parseConcepts, replaceSubjectConcepts, slug, type Concept } from './concepts'

describe('names sent to the concept builder', () => {
  it('drops repeats regardless of case and spacing, keeping every level a name is taught at', () => {
    // Without levels the model marked almost every Geography concept upper
    // secondary, and Lower Secondary topics were offered 22 of 129 concepts.
    expect(namesWithBands([
      { name: 'Cells', band: 'UP' }, { name: ' cells ', band: 'LS' }, { name: 'Atoms', band: 'LS' }, { name: 'CELLS', band: 'LS' },
    ])).toEqual([{ name: 'Atoms', bands: ['LS'] }, { name: 'Cells', bands: ['LS', 'UP'] }])
  })
  it('splits a large subject into chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('makes clean ids', () => {
    expect(slug('Rivers: Erosion & Transport')).toBe('rivers-erosion-transport')
  })
})

describe('the concept prompt', () => {
  it('passes on the ids earlier chunks made, so a large subject does not fork them', () => {
    const existing: Concept[] = [{ id: 'mathematics.simultaneous-equations', subject: 'mathematics', name: 'Simultaneous equations', bands: ['UP'], aliases: [] }]
    const p = conceptPrompt('mathematics', [{ name: 'Solving pairs of equations', bands: ['LS', 'UP'] }], existing)
    expect(p).toContain('simultaneous-equations: Simultaneous equations')
    expect(p).toContain('- Solving pairs of equations [LS, UP]')
  })
  it('tells the model which levels each name is taught at, and not to repeat an idea', () => {
    const p = conceptPrompt('geography', [{ name: 'Rivers', bands: ['LS'] }], [])
    expect(p).toMatch(/levels it is taught at/)
    expect(p).toMatch(/never list the same idea twice/i)
  })
})

describe('parsing concepts', () => {
  it('prefixes ids with the subject and keeps only valid bands', () => {
    const got = parseConcepts('biology', { concepts: [
      { id: 'Photosynthesis', name: 'Photosynthesis', bands: ['ls', 'UP', 'X'], aliases: ['light reactions'] },
      { id: '', name: '', bands: ['P'] },
      { id: 'no-bands', name: 'No bands', bands: [] },
    ] })
    expect(got).toEqual([{ id: 'biology.photosynthesis', subject: 'biology', name: 'Photosynthesis', bands: ['LS', 'UP'], aliases: ['light reactions'] }])
  })
  it('returns nothing for a reply without a concepts list', () => {
    expect(parseConcepts('biology', { something: 1 })).toEqual([])
  })
  it('merges chunks by id, joining bands and aliases', () => {
    const a: Concept = { id: 'b.x', subject: 'b', name: 'X', bands: ['LS'], aliases: ['one'] }
    const b: Concept = { id: 'b.x', subject: 'b', name: 'X', bands: ['UP'], aliases: ['two'] }
    expect(mergeConcepts([[a], [b]])).toEqual([{ id: 'b.x', subject: 'b', name: 'X', bands: ['LS', 'UP'], aliases: ['one', 'two'] }])
  })
  it('loads stored concepts grouped by subject', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO concepts (id, subject, name, bands, aliases) VALUES ('biology.cells', 'biology', 'Cells', '[\"LS\"]', '[]')").run()
    expect(loadConcepts(db).get('biology')?.map((c) => c.id)).toEqual(['biology.cells'])
  })
})

describe('merging duplicates from a subject built in chunks', () => {
  const c = (id: string, name: string, bands: Concept['bands'], aliases: string[] = []): Concept => ({ id: `biology.${id}`, subject: 'biology', name, bands, aliases })
  const list = [c('enzymes', 'Enzymes', ['UP']), c('enzymes-types', 'Types of enzymes', ['LS']), c('enzyme-inhibitors', 'Enzyme inhibitors', ['AL'])]

  it('asks for groups that name the same idea, keeping separate sections apart', () => {
    const p = consolidationPrompt('biology', list)
    expect(p).toContain('enzymes-types: Types of enzymes')
    expect(p).toMatch(/Keep ideas apart/)
  })

  it('folds each duplicate into the one kept, joining levels and keeping its name as an alias', () => {
    const { concepts, merged } = applyMerges('biology', list, { merges: [{ keep: 'enzymes', merge: ['enzymes-types'] }] })
    expect(merged).toBe(1)
    expect(concepts.map((x) => x.id)).toEqual(['biology.enzymes', 'biology.enzyme-inhibitors'])
    expect(concepts[0]).toMatchObject({ bands: ['LS', 'UP'], aliases: ['Types of enzymes'] })
  })

  it('ignores ids that do not exist, a concept merged into itself, and a reply with no merges', () => {
    expect(applyMerges('biology', list, { merges: [{ keep: 'nope', merge: ['enzymes'] }, { keep: 'enzymes', merge: ['enzymes', 'ghost'] }] }).merged).toBe(0)
    expect(applyMerges('biology', list, { something: 1 }).concepts).toHaveLength(3)
  })
})

describe('coarsening a subject split too finely', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ id: `mathematics.c${i}`, subject: 'mathematics', name: `Concept ${i}`, bands: ['UP' as const], aliases: [] }))

  it('sets a section-grain target of about one concept per four names, only when well over it', () => {
    // Mathematics: 1,863 names gave 1,085 concepts. Chemistry: 971 gave 126, which is coarse but harmless.
    expect(coarsenTarget(1085, 1863)).toBe(466)
    expect(coarsenTarget(126, 971)).toBeNull()
    expect(coarsenTarget(50, 60)).toBeNull()
  })

  it('tells the model the target when there is one', () => {
    expect(consolidationPrompt('mathematics', many, 30)).toMatch(/120 concepts[\s\S]*about 30/)
    expect(consolidationPrompt('mathematics', many)).not.toMatch(/about \d+\. Merge/)
  })
})

describe('replacing a subject\'s concepts after topics were mapped', () => {
  // Topic plans name concept ids; a rebuild that replaced the ids left plans
  // pointing at concepts that no longer existed, and they still counted as done.
  function mappedStore() {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'rwanda', 'Geography S2', 'geography', 'LS', 'Rivers')").run()
    db.prepare("INSERT INTO subtopics (key, topic_key, name) VALUES ('db:100', 'db:1', 'Erosion')").run()
    db.prepare("INSERT INTO concepts (id, subject, name, bands, aliases) VALUES ('geography.rivers', 'geography', 'Rivers', '[\"LS\"]', '[]')").run()
    db.prepare("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES ('db:1', '[\"geography.rivers\"]', '[\"geo.map\"]', '[]', 'high', 'm', 'now')").run()
    db.prepare("INSERT INTO subtopic_map (subtopic_key, concepts, kinds) VALUES ('db:100', '[\"geography.rivers\"]', '[\"geo.map\"]')").run()
    return db
  }
  const fresh: Concept[] = [{ id: 'geography.river-processes', subject: 'geography', name: 'River processes', bands: ['LS'], aliases: [] }]

  it('refuses while topic plans use them, unless asked to remap', () => {
    const db = mappedStore()
    expect(() => replaceSubjectConcepts(db, 'geography', fresh, false)).toThrow(/--remap/)
    expect(loadConcepts(db).get('geography')?.map((c) => c.id)).toEqual(['geography.rivers'])
  })

  it('with remap, clears the subject\'s plans so they are mapped again', () => {
    const db = mappedStore()
    expect(replaceSubjectConcepts(db, 'geography', fresh, true)).toBe(1)
    expect(loadConcepts(db).get('geography')?.map((c) => c.id)).toEqual(['geography.river-processes'])
    expect((db.prepare('SELECT COUNT(*) AS n FROM topic_map').get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM subtopic_map').get() as { n: number }).n).toBe(0)
  })

  it('needs no remap for a subject nothing has been mapped to yet', () => {
    const db = openStore(':memory:')
    expect(replaceSubjectConcepts(db, 'geography', fresh, false)).toBe(0)
    expect(mappedTopicCount(db, 'geography')).toBe(0)
  })
})
