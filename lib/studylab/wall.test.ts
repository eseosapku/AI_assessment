import { describe, it, expect } from 'vitest'
import { tilesForSubject, buildWall, wallSummary, priorityTiles } from './wall'

const topic = (over: Record<string, unknown> = {}) => ({
  id: 1, name: 'Forces', status: 'developing', accuracy: 60, attempts: 2,
  last_assessed: '2026-08-01', subtopics: [], ...over,
})
const sub = (over: Record<string, unknown> = {}) => ({
  id: 10, name: 'Moments', status: 'gap', accuracy: 10, attempts: 3,
  last_assessed: '2026-08-02', ...over,
})

describe('tilesForSubject', () => {
  it('uses subtopics where they exist, and not the topic as well', () => {
    // Showing both would double-count the same knowledge and make the wall's
    // proportions lie.
    const tiles = tilesForSubject({
      id: 7, name: 'Physics',
      topics: [topic({ subtopics: [sub(), sub({ id: 11, name: 'Levers', status: 'mastered', accuracy: 90 })] })],
    })
    expect(tiles.map((t) => t.label)).toEqual(['Moments', 'Levers'])
    expect(tiles[0].parentTopic).toBe('Forces')
    expect(tiles[0].isTopicLevel).toBe(false)
  })

  it('falls back to the topic when it has no subtopics', () => {
    // The entire NERDC corpus is like this — 1,056 topics, zero subtopics —
    // so this is the only resolution available for the largest curriculum.
    const tiles = tilesForSubject({ id: 7, name: 'Physics', topics: [topic()] })
    expect(tiles).toHaveLength(1)
    expect(tiles[0].label).toBe('Forces')
    expect(tiles[0].isTopicLevel).toBe(true)
    expect(tiles[0].subtopic_id).toBeNull()
  })

  it('carries the ids the study action needs', () => {
    const tiles = tilesForSubject({ id: 7, name: 'Physics', topics: [topic({ subtopics: [sub()] })] })
    expect(tiles[0]).toMatchObject({ textbook_id: 7, topic_id: 1, subtopic_id: 10 })
  })

  it('survives a malformed tree rather than crashing the page', () => {
    expect(tilesForSubject({})).toEqual([])
    expect(tilesForSubject({ name: 'X', topics: 'not an array' })).toEqual([])
    const odd = tilesForSubject({ name: 'X', topics: [{ subtopics: [{}] }] })
    expect(odd).toHaveLength(1)
    expect(odd[0].label).toBe('Untitled')
    expect(odd[0].status).toBe('not_assessed')
  })
})

describe('buildWall', () => {
  const tree = [
    {
      id: 1, name: 'Biology',
      topics: [{ id: 1, name: 'Cells', subtopics: [
        { id: 1, name: 'Mitochondria', status: 'mastered', accuracy: 90 },
        { id: 2, name: 'Nucleus', status: 'developing', accuracy: 55 },
      ] }],
    },
    {
      id: 2, name: 'Physics',
      topics: [{ id: 2, name: 'Forces', subtopics: [
        { id: 3, name: 'Moments', status: 'gap', accuracy: 10 },
        { id: 4, name: 'Friction', status: 'gap', accuracy: 30 },
        { id: 5, name: 'Levers', status: 'mastered', accuracy: 85 },
      ] }],
    },
  ]

  it('opens on the subject with the most gaps', () => {
    expect(buildWall(tree).map((s) => s.subject)).toEqual(['Physics', 'Biology'])
  })

  it('sorts the work to the front of each subject, weakest first', () => {
    const physics = buildWall(tree)[0]
    expect(physics.tiles.map((t) => t.label)).toEqual(['Moments', 'Friction', 'Levers'])
  })

  it('counts each status and the solid ratio', () => {
    const physics = buildWall(tree)[0]
    expect(physics.counts).toEqual({ gap: 2, developing: 0, mastered: 1, not_assessed: 0 })
    expect(physics.solidRatio).toEqual({ solid: 1, assessed: 3 })
  })

  it('merges subjects that canonicalise to the same name', () => {
    // Four Biology textbooks are one subject to a student.
    const merged = buildWall(
      [
        { id: 1, name: 'Biology S4 SB', topics: [{ id: 1, name: 'Cells', subtopics: [{ id: 1, name: 'A', status: 'gap', accuracy: 10 }] }] },
        { id: 2, name: 'Biology S5 SB', topics: [{ id: 2, name: 'Genes', subtopics: [{ id: 2, name: 'B', status: 'gap', accuracy: 20 }] }] },
      ],
      (s) => s.replace(/ S\d SB$/, ''),
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].subject).toBe('Biology')
    expect(merged[0].tiles).toHaveLength(2)
  })

  it('drops a subject with nothing in it rather than showing an empty row', () => {
    expect(buildWall([{ id: 1, name: 'Empty', topics: [] }])).toEqual([])
    expect(buildWall([{ id: 1, name: '', topics: [{ id: 1, name: 'X' }] }])).toEqual([])
  })

  it('reports no solid ratio when nothing has been assessed', () => {
    const wall = buildWall([{ id: 1, name: 'New', topics: [{ id: 1, name: 'Untouched', status: 'not_assessed' }] }])
    expect(wall[0].solidRatio).toBeNull()
  })
})

describe('wallSummary', () => {
  it('totals every status across every subject', () => {
    const wall = buildWall([
      { id: 1, name: 'A', topics: [{ id: 1, name: 't', subtopics: [{ id: 1, status: 'gap', name: 'x' }, { id: 2, status: 'mastered', name: 'y' }] }] },
      { id: 2, name: 'B', topics: [{ id: 2, name: 'u', subtopics: [{ id: 3, status: 'gap', name: 'z' }] }] },
    ])
    expect(wallSummary(wall)).toEqual({ gap: 2, developing: 0, mastered: 1, not_assessed: 0 })
  })

  it('handles an empty wall', () => {
    expect(wallSummary([])).toEqual({ gap: 0, developing: 0, mastered: 0, not_assessed: 0 })
  })
})

describe('priorityTiles', () => {
  const wall = buildWall([
    { id: 1, name: 'Physics', topics: [{ id: 1, name: 'F', subtopics: [
      { id: 1, name: 'Moments', status: 'gap', accuracy: 10 },
      { id: 2, name: 'Friction', status: 'gap', accuracy: 30 },
      { id: 3, name: 'Shaky', status: 'developing', accuracy: 55 },
    ] }] },
  ])

  it('takes the weakest gaps across the whole wall', () => {
    expect(priorityTiles(wall, 2).map((t) => t.label)).toEqual(['Moments', 'Friction'])
  })

  it('offers only genuine gaps', () => {
    // A "fix this first" card for something already developing would push a
    // student off the thing that is actually failing.
    expect(priorityTiles(wall, 5).map((t) => t.label)).not.toContain('Shaky')
  })

  it('returns nothing when there are no gaps', () => {
    const clean = buildWall([{ id: 1, name: 'A', topics: [{ id: 1, name: 't', subtopics: [{ id: 1, name: 'x', status: 'mastered', accuracy: 95 }] }] }])
    expect(priorityTiles(clean)).toEqual([])
  })
})
