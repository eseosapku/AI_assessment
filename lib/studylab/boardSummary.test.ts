// lib/studylab/boardSummary.test.ts
import { describe, it, expect } from 'vitest'
import { boardSummary, parseBoardSummary } from './boardSummary'
import type { StudyNode } from './types'

const card = (id: string, title: string, step: number): StudyNode => ({
  id, type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', title, step },
})

describe('boardSummary', () => {
  it('lists the cards on the canvas with their step', () => {
    const s = boardSummary({ nodes: [card('a', 'Atoms', 1), card('b', 'Bonds', 2)] })
    expect(s.cards).toEqual([
      { id: 'a', title: 'Atoms', step: 1, kind: 'concept' },
      { id: 'b', title: 'Bonds', step: 2, kind: 'concept' },
    ])
  })

  it('skips hidden cards — a collapsed step is still on the board, but nothing there is visible to build on', () => {
    const hidden = { ...card('a', 'Atoms', 1), hidden: true }
    expect(boardSummary({ nodes: [hidden, card('b', 'Bonds', 1)] }).cards).toHaveLength(1)
  })

  it('skips untitled cards, which cannot be recognised or referred to', () => {
    expect(boardSummary({ nodes: [card('a', '  ', 1)] }).cards).toEqual([])
  })

  it('ignores non-card nodes such as step groups and sticky notes', () => {
    const group: StudyNode = {
      id: 'g1', type: 'stepGroup', position: { x: 0, y: 0 },
      data: { kind: 'stepGroup', title: 'Step 1', step: 1 },
    }
    expect(boardSummary({ nodes: [group, card('a', 'Atoms', 1)] }).cards).toEqual([
      { id: 'a', title: 'Atoms', step: 1, kind: 'concept' },
    ])
  })

  it('collects the steps that already carry a check, deduplicated and sorted', () => {
    const quiz = (id: string, step: number): StudyNode => ({
      id, type: 'quiz', position: { x: 0, y: 0 }, data: { kind: 'quiz', step },
    })
    expect(boardSummary({ nodes: [quiz('q2', 2), quiz('q1', 1), quiz('q1b', 1)] }).checkedSteps)
      .toEqual([1, 2])
  })

  it('keeps only the last few chat turns, and truncates long ones', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ role: 'assistant', content: `m${i}` }))
    const s = boardSummary({ nodes: [] }, many)
    expect(s.recent).toHaveLength(6)
    expect(s.recent[5].text).toBe('m9')

    const long = boardSummary({ nodes: [] }, [{ role: 'user', content: 'x'.repeat(500) }])
    expect(long.recent[0].text).toHaveLength(240)
  })

  it('drops empty messages rather than sending blank turns', () => {
    expect(boardSummary({ nodes: [] }, [{ role: 'assistant', content: '   ' }]).recent).toEqual([])
  })

  it('survives a missing canvas', () => {
    expect(boardSummary(null)).toEqual({
      cards: [], checkedSteps: [], cardsSinceCheck: {}, askedByStep: {}, recent: [],
    })
  })
})

describe('parseBoardSummary', () => {
  it('defaults a missing kind rather than dropping the card', () => {
    expect(parseBoardSummary({ cards: [{ id: 'a', title: 'A' }] }).cards[0].kind).toBe('concept')
  })

  it('returns an empty board for anything that is not one', () => {
    const empty = { cards: [], checkedSteps: [], cardsSinceCheck: {}, askedByStep: {}, recent: [] }
    expect(parseBoardSummary(null)).toEqual(empty)
    expect(parseBoardSummary('nope')).toEqual(empty)
    expect(parseBoardSummary({})).toEqual(empty)
  })

  it('drops malformed cards instead of rejecting the whole board', () => {
    const parsed = parseBoardSummary({
      cards: [{ id: 'a', title: 'Atoms', step: 1, kind: 'table' }, { id: 5 }, null, { title: 'no id' }],
    })
    expect(parsed.cards).toEqual([{ id: 'a', title: 'Atoms', step: 1, kind: 'table' }])
  })

  it('coerces a missing step to 0 rather than NaN, which would print as "step NaN"', () => {
    expect(parseBoardSummary({ cards: [{ id: 'a', title: 'A' }] }).cards[0].step).toBe(0)
  })

  it('keeps only positive integer checked steps', () => {
    expect(parseBoardSummary({ checkedSteps: [1, 0, -2, 'x', 3.5, 4] }).checkedSteps).toEqual([1, 4])
  })

  it('treats any non-user role as the assistant', () => {
    expect(parseBoardSummary({ recent: [{ role: 'system', text: 'hi' }] }).recent[0].role)
      .toBe('assistant')
  })
})
