import { describe, expect, it } from 'vitest'
import { askedWith, isSeenPair, orderForStudent, readSeenFigures, seenFromRows } from './student-figure-history'
import { questionKey } from './figure-question-bank'

describe('seenFromRows', () => {
  it('collects the figures and questions a student was shown', () => {
    const seen = seenFromRows([
      { image: '/textbook-images/a.png', text: 'Which gas?' },
      { image: '/textbook-images/b.png', text: null },
      { image: null, text: 'No figure here' },
    ])
    expect([...seen.images]).toEqual(['/textbook-images/a.png', '/textbook-images/b.png'])
    expect(seen.questions.has(questionKey('which  gas?'))).toBe(true)
    expect(seen.questions.size).toBe(2)
  })
})

describe('orderForStudent', () => {
  const fig = (id: string) => ({ id, localPath: `/${id}.png` })
  const figures = [fig('seenStale1'), fig('fresh1'), fig('seenNewQ'), fig('seenStale2'), fig('fresh2'), fig('seenStale3')]
  const seen = { images: new Set(['/seenStale1.png', '/seenNewQ.png', '/seenStale2.png', '/seenStale3.png']), questions: new Set<string>(), askedWith: new Map() }
  const hasFresh = (f: { id: string }) => f.id === 'seenNewQ'

  it('puts unseen figures first, then seen ones with a new question, then a few repeats', () => {
    expect(orderForStudent(figures, seen, hasFresh, 2).map((f) => f.id)).toEqual(['fresh1', 'fresh2', 'seenNewQ', 'seenStale1', 'seenStale2'])
  })
  it('keeps at most the given number of figures whose questions were all seen', () => {
    expect(orderForStudent(figures, seen, hasFresh, 0).map((f) => f.id)).toEqual(['fresh1', 'fresh2', 'seenNewQ'])
  })
  it('changes nothing for a student with no history', () => {
    const none = { images: new Set<string>(), questions: new Set<string>(), askedWith: new Map() }
    expect(orderForStudent(figures, none, hasFresh)).toEqual(figures)
  })
})

describe('pairs of figure and question', () => {
  it('records which questions were asked with which figure', () => {
    const seen = seenFromRows([{ image: '/a.png', text: 'What is the median?' }, { image: '/b.png', text: 'What is the range?' }])
    expect(isSeenPair(seen, '/a.png', 'what is the  median?')).toBe(true)
    // The same wording on another figure is a new pair: a drawn family asks it of a thousand figures.
    expect(isSeenPair(seen, '/b.png', 'What is the median?')).toBe(false)
    expect([...askedWith(seen, '/a.png')]).toEqual([questionKey('What is the median?')])
    expect(askedWith(seen, '/none.png').size).toBe(0)
  })

  it('lets no figure through whose questions were all asked with it, unless told to', () => {
    const fig = (id: string) => ({ id, localPath: `/${id}.png` })
    const seen = { images: new Set(['/old.png']), questions: new Set<string>(), askedWith: new Map() }
    expect(orderForStudent([fig('old'), fig('new')], seen, () => false).map((f) => f.id)).toEqual(['new'])
  })
})

describe('readSeenFigures', () => {
  it("reads the student's last quizzes of any kind and any book", async () => {
    const calls: [string, unknown[] | undefined][] = []
    const db = { query: async (sql: string, values?: unknown[]) => { calls.push([sql, values]); return { rows: [{ image: '/a.png', text: 'Q?' }] } as never } }
    const seen = await readSeenFigures(db, 'u1')
    expect(isSeenPair(seen, '/a.png', 'Q?')).toBe(true)
    expect(calls[0][0]).not.toMatch(/textbook_id/)
    expect(calls[0][1]).toEqual(['u1', 50])
  })

  it('compares the student id as a uuid, so the user_id index is used', async () => {
    // user_id::text = $1 cast the indexed uuid column and scanned every quiz on every request.
    const calls: string[] = []
    const db = { query: async (sql: string) => { calls.push(sql); return { rows: [] } as never } }
    await readSeenFigures(db, '7b0e5c1e-0000-4000-8000-000000000000')
    expect(calls[0]).toMatch(/user_id = \$1::uuid/)
    expect(calls[0]).not.toMatch(/user_id::text/)
  })

  it('gives no history when the lookup fails', async () => {
    const db = { query: async () => { throw new Error('down') } }
    const seen = await readSeenFigures(db as never, 'u1')
    expect(seen.images.size + seen.questions.size + seen.askedWith.size).toBe(0)
  })
})
