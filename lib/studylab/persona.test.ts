import { describe, it, expect } from 'vitest'
import { buildPersonaFromGapTree } from './persona'

const sub = (id: number, o: Record<string, unknown> = {}) => ({ id, name: `S${id}`, status: 'not_assessed', accuracy: null, last_assessed: null, ...o })
const tree = (subtopics: any[], topic: Record<string, unknown> = {}, summary = { gap: 9, developing: 9, mastered: 9, not_assessed: 0 }) => ({
  textbooks: [{ id: 1, name: 'Maths', status: 'gap', accuracy: null, assessments: [], topics: [{ id: 10, name: 'Algebra', status: 'not_assessed', accuracy: null, last_assessed: null, subtopics, ...topic }] }],
  summary,
}) as any

describe('buildPersonaFromGapTree bands', () => {
  it('judges a closed section (average 65, score 100) as mastered, not a gap', () => {
    const p = buildPersonaFromGapTree(tree([sub(1, { status: 'developing', accuracy: 65, score: 100, lowest: 30 })]))
    expect(p.weakAreas).toEqual([])
    expect(p.summary).toMatchObject({ gaps: 0, developing: 0, mastered: 1 })
  })
  it('judges by score when it is lower than the average', () => {
    const p = buildPersonaFromGapTree(tree([sub(1, { status: 'mastered', accuracy: 85, score: 30, lowest: 30 })]))
    expect(p.weakAreas[0]).toMatchObject({ status: 'gap', accuracy: 30 })
    expect(p.summary).toMatchObject({ gaps: 1, developing: 0, mastered: 0 })
  })
  it('falls back to accuracy when there is no score', () => {
    const p = buildPersonaFromGapTree(tree([sub(1, { accuracy: 60 }), sub(2, { accuracy: 90 })]))
    expect(p.weakAreas[0]).toMatchObject({ status: 'developing', accuracy: 60 })
    expect(p.summary).toMatchObject({ gaps: 0, developing: 1, mastered: 1 })
  })
  it('counts a chapter judged as a whole when no section was tried', () => {
    const p = buildPersonaFromGapTree(tree([sub(1)], { accuracy: 70, score: 20, lowest: 20 }))
    expect(p.weakAreas[0]).toMatchObject({ kind: 'topic', status: 'gap' })
    expect(p.summary.gaps).toBe(1)
  })
})
