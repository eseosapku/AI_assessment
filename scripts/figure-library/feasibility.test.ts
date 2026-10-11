// scripts/figure-library/feasibility.test.ts
import { describe, it, expect } from 'vitest'
import { KIND_BY_ID } from './figureKinds'
import { assess, subtopicOk, summarise, type PlanRow } from './feasibility'

const plan = (kinds: string[], terms: string[] = []): PlanRow => ({ key: 'k', source: 'rwanda', subject: 'geography', band: 'LS', name: 'Rivers', kinds, terms, visual: 'high' })
const hits = (table: Record<string, number>) => (t: string) => table[t]

describe('whether a topic can reach 50 figures with variety', () => {
  it('is ready with six or more kinds that can actually supply figures', () => {
    const a = assess(plan(['geo.map', 'geo.section', 'graph.line', 'photo.landscape', 'photo.specimen', 'table.data'], ['oxbow lake', 'meander']), hits({ 'oxbow lake': 400, meander: 900 }), KIND_BY_ID)
    expect(a).toMatchObject({ drawnKinds: 4, realKinds: 2, realEstimate: 195, realUnits: 2, variety: 6, status: 'ready' })
  })

  it('does not count a real kind that has too few candidate images', () => {
    const a = assess(plan(['geo.map', 'photo.landscape', 'photo.specimen'], ['rare term']), hits({ 'rare term': 30 }), KIND_BY_ID)
    expect(a).toMatchObject({ realEstimate: 5, realUnits: 0, variety: 1, status: 'hard' })
  })

  it('caps one broad term so it cannot carry a topic alone', () => {
    const a = assess(plan(['photo.landscape'], ['water']), hits({ water: 3_000_000 }), KIND_BY_ID)
    expect(a.realEstimate).toBe(300)
  })

  it('treats a term not yet counted as no supply', () => {
    const a = assess(plan(['photo.landscape'], ['unprobed']), hits({}), KIND_BY_ID)
    expect(a.realEstimate).toBe(0)
  })

  it('keeps the strict status by kind, and says separately when planned families would make it ready', () => {
    // Two geometry-type kinds are "hard" by kind count, but geometry alone plans
    // six families. Strict status stays; "likely" flags it for the report.
    const a = assess(plan(['maths.geometry', 'maths.coordinate']), hits({}), KIND_BY_ID)
    expect(a).toMatchObject({ drawnKinds: 2, familyVariety: 9, status: 'hard', likely: true })
    const ready = assess(plan(['geo.map', 'geo.section', 'graph.line', 'table.data', 'timeline', 'process.flow']), hits({}), KIND_BY_ID)
    expect(ready.likely).toBe(false)
  })

  it('calls three to five sources thin', () => {
    expect(assess(plan(['geo.map', 'geo.section', 'graph.line']), hits({}), KIND_BY_ID).status).toBe('thin')
  })
})

describe('subtopics', () => {
  it('need two kinds of their own and a topic that is not hard', () => {
    expect(subtopicOk(2, 'ready')).toBe(true)
    expect(subtopicOk(1, 'ready')).toBe(false)
    expect(subtopicOk(3, 'hard')).toBe(false)
  })
})

describe('the summary', () => {
  it('counts by status, subject and source', () => {
    const s = summarise([
      { plan: plan(['geo.map']), assessment: { key: 'a', drawnKinds: 6, realKinds: 0, realEstimate: 0, realUnits: 0, variety: 6, status: 'ready', familyVariety: 12, likely: false } },
      { plan: { ...plan(['geo.map']), subject: 'english', source: 'waec' }, assessment: { key: 'b', drawnKinds: 1, realKinds: 0, realEstimate: 0, realUnits: 0, variety: 1, status: 'hard', familyVariety: 6, likely: true } },
    ])
    expect(s.byStatus).toEqual({ ready: 1, thin: 0, hard: 1 })
    expect(s.bySubject.english).toEqual({ ready: 0, thin: 0, hard: 1 })
    expect(s.bySource.rwanda).toEqual({ ready: 1, thin: 0, hard: 0 })
    expect(s.likely).toBe(1)
    expect(s.likelyBySubject).toEqual({ english: 1 })
  })
})
