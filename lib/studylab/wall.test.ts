import { describe, it, expect } from 'vitest'
import { tilesForSubject, unplacedQuizzes, unlinkedSummary, pickRequestedSubject } from './wall'

describe('unplacedQuizzes', () => {
  const quiz = (over: Record<string, unknown> = {}) => ({ id: 'a1', label: 'Physics quiz', percentage: 70, created_at: '2026-05-02T10:00:00Z', ...over })
  const grey = { id: 7, name: 'Physics', topics: [{ id: 1, name: 'Forces', subtopics: [{ id: 2, name: 'Moments', status: 'not_assessed' }] }], assessments: [quiz(), quiz({ id: 'a2', percentage: 40, created_at: '2026-06-01T10:00:00Z' })] }
  const placed = { id: 8, name: 'Biology', topics: [{ id: 3, name: 'Cells', subtopics: [{ id: 4, name: 'Nucleus', status: 'gap', accuracy: 20 }] }], assessments: [quiz({ id: 'b1', label: 'Biology quiz' })] }
  const noTree = { id: null, name: 'Chemistry', topics: [], assessments: [quiz({ id: 'c1', label: 'Acids', percentage: 55 })] }
  const noQuizzes = { id: 9, name: 'History', topics: [], assessments: [] }

  it('lists the quizzes of a subject the map could not colour, newest first, with their average', () => {
    const out = unplacedQuizzes([grey])
    expect(out).toHaveLength(1)
    expect(out[0].subject).toBe('Physics')
    expect(out[0].quizzes.map((q) => q.id)).toEqual(['a2', 'a1'])
    expect(out[0].average).toBe(55)
  })
  it('includes a subject with no chapter list at all', () => {
    expect(unplacedQuizzes([noTree]).map((s) => s.subject)).toEqual(['Chemistry'])
  })
  it('leaves out a subject the map did colour, and one with no quizzes', () => {
    expect(unplacedQuizzes([placed, noQuizzes])).toEqual([])
  })
  it('leaves out a subject with chapter-level evidence and no section evidence', () => {
    const chapterOnly = { id: 7, name: 'Physics', topics: [{ id: 1, name: 'Forces', status: 'gap', accuracy: 40, subtopics: [{ id: 2, name: 'Moments', status: 'not_assessed' }] }], assessments: [quiz()] }
    expect(unplacedQuizzes([chapterOnly])).toEqual([])
  })
  it('survives a malformed subject rather than crashing the page', () => {
    expect(unplacedQuizzes([{}, { name: 'X', assessments: 'nope' }, null as any])).toEqual([])
  })
})

describe('pickRequestedSubject', () => {
  const legacy = { id: null, name: 'Mathematics', topics_assessed: 0, last_assessed: '2026-06-17', assessments: [{ id: 'old' }] }
  const book = { id: 610, name: 'Cambridge Lower Secondary Mathematics Stage 8', topics_assessed: 4, last_assessed: '2026-10-08', assessments: [{ id: 'new' }] }
  const science = { id: 9, name: 'Science', topics_assessed: 2, last_assessed: '2026-10-01', assessments: [{ id: 's1' }] }

  it('opens the subject that holds the quiz the student just finished', () => {
    // "Study these areas" from a Maths quiz opened an old June "Mathematics"
    // quiz saved with no book: it was first by name and sorted weakest first.
    expect(pickRequestedSubject([legacy, book, science], { assessmentId: 'new', name: 'Mathematics' })?.id).toBe(610)
  })
  it('by name, prefers a real book with tested topics over a name-only bucket', () => {
    expect(pickRequestedSubject([legacy, book], { name: 'Mathematics' })?.id).toBe(610)
  })
  it('falls back to the only match, and to nothing when none matches', () => {
    expect(pickRequestedSubject([legacy], { name: 'Mathematics' })?.name).toBe('Mathematics')
    expect(pickRequestedSubject([science], { name: 'History' })).toBeUndefined()
    expect(pickRequestedSubject([science], {})).toBeUndefined()
  })
})

describe('unlinkedSummary', () => {
  it('counts and averages results that belong to no quiz', () => {
    expect(unlinkedSummary([{ percentage: 80, created_at: '2026-05-01' }, { percentage: 40, created_at: '2026-06-01' }]))
      .toEqual({ count: 2, average: 60, last: '2026-06-01' })
  })
  it('is null when there are none', () => {
    expect(unlinkedSummary([])).toBeNull()
  })
  it('finds the latest by time when the database hands back Date objects', () => {
    const out = unlinkedSummary([{ percentage: 50, created_at: new Date('2026-09-30T10:00:00Z') }, { percentage: 70, created_at: new Date('2026-10-02T10:00:00Z') }])
    expect(out?.last).toBe('2026-10-02T10:00:00.000Z')
  })
  it('skips a score that is not a number in the average but still counts the result', () => {
    expect(unlinkedSummary([{ percentage: null, created_at: null }, { percentage: '50', created_at: '2026-05-01' }]))
      .toEqual({ count: 2, average: 50, last: '2026-05-01' })
  })
})

const topic = (over: Record<string, unknown> = {}) => ({
  id: 1, name: 'Forces', status: 'developing', accuracy: 60, attempts: 2,
  last_assessed: '2026-08-01', subtopics: [], ...over,
})
const sub = (over: Record<string, unknown> = {}) => ({
  id: 10, name: 'Moments', status: 'gap', accuracy: 10, attempts: 3,
  last_assessed: '2026-08-02', ...over,
})

describe('tilesForSubject', () => {
  it('gives an unscored section a null accuracy, not 0', () => {
    const tiles = tilesForSubject({ id: 7, name: 'Physics', topics: [topic({ subtopics: [sub({ status: 'not_assessed', accuracy: null })] })] })
    expect(tiles[0].accuracy).toBeNull()
  })

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
