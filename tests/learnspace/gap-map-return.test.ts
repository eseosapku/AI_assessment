import { describe, it, expect } from 'vitest'
import { buildRack, changesSince, nextFix, snapshotRack, totalGaps, visibleTrays } from '@/lib/studylab/rack'

const section = (id: number, name: string, score: number | null, lowest: number | null = score) => ({
  id, name, score, lowest, attempts: score === null ? 0 : 4,
})

const book = (id: number, name: string, topics: unknown[]) => ({ id, name, topics })

describe('the tile rack', () => {
  const weak = book(1, 'Cambridge IGCSE Economics', [
    { id: 10, name: 'The basic economic problem', subtopics: [section(101, 'Opportunity cost', 90, 90)] },
    { id: 11, name: 'How markets work', subtopics: [section(111, 'Demand', 30, 30), section(112, 'Supply', 70, 70)] },
  ])

  it('puts the gap chapter first and points Kana at the lowest section', () => {
    const trays = buildRack([weak])
    expect(trays).toHaveLength(1)
    expect(trays[0].subject).toBe('Economics')
    expect(trays[0].level).toMatch(/IGCSE/)
    expect(trays[0].chapters.map((c) => c.name)).toEqual(['How markets work', 'The basic economic problem'])
    expect(totalGaps(trays)).toBe(1)
    expect(nextFix(trays)?.section?.name).toBe('Demand')
    expect(nextFix(trays)?.chapter.name).toBe('How markets work')
  })

  it('two books of the same subject and level share a tray', () => {
    const second = book(2, 'Cambridge IGCSE Economics Coursebook', [
      { id: 12, name: 'Money', subtopics: [section(121, 'Functions of money', null)] },
    ])
    const trays = buildRack([weak, second])
    expect(trays).toHaveLength(1)
    expect(trays[0].chapters.map((c) => c.topicId).sort()).toEqual([10, 11, 12])
  })

  it('coming back, a closed gap drops and a section that was under 50 turns gold', () => {
    const before = snapshotRack(buildRack([weak]))
    const afterBook = book(1, 'Cambridge IGCSE Economics', [
      { id: 10, name: 'The basic economic problem', subtopics: [section(101, 'Opportunity cost', 90, 90)] },
      { id: 11, name: 'How markets work', subtopics: [section(111, 'Demand', 88, 30), section(112, 'Supply', 70, 70)] },
    ])
    const trays = buildRack([afterBook])
    const change = changesSince(before, trays)
    expect(change.dropped).toEqual([11])
    expect(change.gold).toHaveLength(1)
    expect(changesSince(null, trays)).toEqual({ dropped: [], gold: [] })
  })

  it('folds away the trays past the first six', () => {
    const named = [
      'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Accounting', 'Business',
    ].map((subject, i) => book(i + 1, `Cambridge IGCSE ${subject}`, [
      { id: 100 + i, name: 'Chapter', subtopics: [section(200 + i, 'Section', 40, 40)] },
    ]))
    const trays = buildRack(named)
    expect(trays).toHaveLength(8)
    expect(visibleTrays(trays, false).shown).toHaveLength(6)
    expect(visibleTrays(trays, false).hidden).toBe(2)
    expect(visibleTrays(trays, true).shown).toHaveLength(8)
  })
})
