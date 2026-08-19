import { describe, it, expect } from 'vitest'
import { tilesForSubject, buildWall, wallSummary, priorityTiles, groupByTopic, tileMatches, filterWall } from './wall'

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

describe('groupByTopic', () => {
  it('gathers subtopics under their topic heading', () => {
    const tiles = tilesForSubject({
      id: 1, name: 'Geography',
      topics: [
        { id: 1, name: 'Agricultural Systems in Rwanda', subtopics: [
          { id: 1, name: 'Livestock farming', status: 'gap', accuracy: 0 },
          { id: 2, name: 'Impact of Agriculture', status: 'gap', accuracy: 0 },
        ] },
        { id: 2, name: 'Climate and Climate Change', subtopics: [
          { id: 3, name: 'Effects of climate change', status: 'gap', accuracy: 30 },
        ] },
      ],
    })
    const groups = groupByTopic(tiles)
    expect(groups.map((g) => g.topic)).toEqual(['Agricultural Systems in Rwanda', 'Climate and Climate Change'])
    expect(groups[0].tiles).toHaveLength(2)
  })

  it('gives a topic-level tile no heading, so its name is not printed twice', () => {
    const tiles = tilesForSubject({ id: 1, name: 'X', topics: [{ id: 1, name: 'Forces', status: 'gap' }] })
    expect(groupByTopic(tiles)[0].topic).toBe('')
  })
})

describe('tileMatches', () => {
  const tile = tilesForSubject({
    id: 1, name: 'Geography',
    topics: [{ id: 1, name: 'Agricultural Systems', subtopics: [{ id: 1, name: 'Livestock farming', status: 'gap' }] }],
  })[0]

  it('matches on the tile name, case-insensitively', () => {
    expect(tileMatches(tile, 'livestock')).toBe(true)
    expect(tileMatches(tile, 'LIVESTOCK')).toBe(true)
  })

  it('also matches on the parent topic, so a topic search finds its subtopics', () => {
    expect(tileMatches(tile, 'agricultural')).toBe(true)
  })

  it('matches everything on an empty query', () => {
    expect(tileMatches(tile, '')).toBe(true)
    expect(tileMatches(tile, '   ')).toBe(true)
  })

  it('does not match something absent', () => {
    expect(tileMatches(tile, 'photosynthesis')).toBe(false)
  })
})

describe('filterWall', () => {
  const wall = buildWall([
    { id: 1, name: 'Geography', topics: [{ id: 1, name: 'Farming', subtopics: [
      { id: 1, name: 'Livestock farming', status: 'gap', accuracy: 0 },
      { id: 2, name: 'Irrigation', status: 'not_assessed' },
      { id: 3, name: 'Soil types', status: 'mastered', accuracy: 90 },
    ] }] },
  ])

  it('hides untested topics by default, because they drown everything else', () => {
    // Live: one subject had 8 assessed topics and 88 untested ones.
    const filtered = filterWall(wall)
    expect(filtered[0].tiles.map((t) => t.label)).toEqual(['Livestock farming', 'Soil types'])
  })

  it('brings them back when asked', () => {
    expect(filterWall(wall, { includeUntested: true })[0].tiles).toHaveLength(3)
  })

  it('narrows to a search, and regroups what is left', () => {
    const filtered = filterWall(wall, { query: 'livestock' })
    expect(filtered[0].tiles.map((t) => t.label)).toEqual(['Livestock farming'])
    expect(filtered[0].groups[0].tiles).toHaveLength(1)
  })

  it('drops a subject with no matches rather than showing an empty heading', () => {
    expect(filterWall(wall, { query: 'nothing here' })).toEqual([])
  })
})

describe('coverage', () => {
  const wall = buildWall([
    { id: 1, name: 'Science', topics: [{ id: 1, name: 'States of matter', subtopics: [
      { id: 1, name: 'Boiling', status: 'mastered', accuracy: 100 },
      { id: 2, name: 'Melting', status: 'mastered', accuracy: 100 },
      { id: 3, name: 'Sublimation', status: 'not_assessed' },
      { id: 4, name: 'Diffusion', status: 'not_assessed' },
    ] }] },
  ])

  it('counts tested against the whole subject, not against what was tested', () => {
    // "2 of 2 solid" reads as finished; "2 of 4 quizzed" does not. That gap is
    // what the old tree communicated and the first wall lost.
    expect(wall[0].coverage).toEqual({ tested: 2, total: 4 })
    expect(wall[0].solidRatio).toEqual({ solid: 2, assessed: 2 })
  })

  it('keeps coverage describing the whole subject when the view is filtered', () => {
    // A bar that shrank with a search would claim more of the syllabus had
    // been covered than actually has.
    const hidden = filterWall(wall, { includeUntested: false })
    expect(hidden[0].tiles).toHaveLength(2)
    expect(hidden[0].coverage).toEqual({ tested: 2, total: 4 })

    const searched = filterWall(wall, { query: 'boiling', includeUntested: true })
    expect(searched[0].coverage).toEqual({ tested: 2, total: 4 })
  })

  it('reports zero tested for an untouched subject rather than nothing', () => {
    const fresh = buildWall([{ id: 1, name: 'New', topics: [{ id: 1, name: 'X', status: 'not_assessed' }] }])
    expect(fresh[0].coverage).toEqual({ tested: 0, total: 1 })
  })
})
