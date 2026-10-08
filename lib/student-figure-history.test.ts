import { describe, expect, it } from 'vitest'
import { orderForStudent, seenFromRows } from './student-figure-history'
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
  const seen = { images: new Set(['/seenStale1.png', '/seenNewQ.png', '/seenStale2.png', '/seenStale3.png']), questions: new Set<string>() }
  const hasFresh = (f: { id: string }) => f.id === 'seenNewQ'

  it('puts unseen figures first, then seen ones with a new question, then a few repeats', () => {
    expect(orderForStudent(figures, seen, hasFresh).map((f) => f.id)).toEqual(['fresh1', 'fresh2', 'seenNewQ', 'seenStale1', 'seenStale2'])
  })
  it('keeps at most the given number of figures whose questions were all seen', () => {
    expect(orderForStudent(figures, seen, hasFresh, 0).map((f) => f.id)).toEqual(['fresh1', 'fresh2', 'seenNewQ'])
  })
  it('changes nothing for a student with no history', () => {
    const none = { images: new Set<string>(), questions: new Set<string>() }
    expect(orderForStudent(figures, none, hasFresh)).toEqual(figures)
  })
})
