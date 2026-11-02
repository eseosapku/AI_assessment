// lib/studylab/trail/furniture.test.ts
import { describe, it, expect } from 'vitest'
import type { LessonRun } from '../lessonRun'
import { BACK_TO_CARD_HINT, escapeTarget, stationPills, topBarLabel, trailMenu } from './furniture'

describe('the back-to-my-card pill', () => {
  it('explains itself in plain words', () => {
    expect(BACK_TO_CARD_HINT).toMatch(/moved the board/)
    expect(BACK_TO_CARD_HINT).toMatch(/back to the card/)
  })
})

const runWith = (statuses: string[], currentStep: number) =>
  ({ phase: 'teaching', pace: 'step', recipe: 'station', currentStep, beats: 0, awaiting: false, steps: statuses.map((status, i) => ({ id: `s${i}`, title: `S${i}`, goal: '', status, cardIds: [] })) }) as unknown as LessonRun
const at = (i: number, title: string) => {
  const run = runWith(['done', 'teaching', 'pending'], i)
  run.steps[i].title = title
  return run
}
const planning = () => ({ ...runWith([], -1), phase: 'planning' }) as LessonRun

describe('the Board menu', () => {
  it('holds exactly what the spec lists', () => {
    expect(trailMenu({ canClassic: true, muted: false }).map((i) => i.label)).toEqual(['See the whole board', 'Back to my card', 'Zoom in', 'Zoom out', 'Add a block', 'Sound off', 'Back to the classic look'])
    expect(trailMenu({ canClassic: true, muted: true }).map((i) => i.label)).toContain('Sound on')
  })
  it('leaves out the way back when there is none', () => {
    expect(trailMenu({ canClassic: false, muted: false }).map((i) => i.label)).not.toContain('Back to the classic look')
  })
})

describe('stationPills', () => {
  it('done green, current subject, rest grey, including a jump back', () => {
    const run = runWith(['done', 'teaching', 'done', 'pending'], 1)
    expect(stationPills(run).map((p) => p.tone)).toEqual(['done', 'current', 'done', 'rest'])
  })
  it('a station tested out of counts as done', () => {
    expect(stationPills(runWith(['known', 'teaching'], 1)).map((p) => p.tone)).toEqual(['done', 'current'])
  })
  it('while planning, the plan on the table', () => {
    expect(stationPills(planning(), [{ id: 'a' }, { id: 'b' }]).map((p) => p.tone)).toEqual(['rest', 'rest'])
    expect(stationPills(null)).toEqual([])
  })
})

describe('topBarLabel', () => {
  it('says where you are', () => {
    expect(topBarLabel({ run: at(1, 'Supply'), lookingBack: null, detourOpen: true })).toBe('Detour')
    expect(topBarLabel({ run: at(1, 'Supply'), lookingBack: 'Demand', detourOpen: false })).toBe('Looking back')
    expect(topBarLabel({ run: at(1, 'Supply'), lookingBack: null, detourOpen: false })).toBe('Supply')
    expect(topBarLabel({ run: planning(), lookingBack: null, detourOpen: false })).toBe('Your plan')
  })
  it('a finished lesson has no current station', () => {
    expect(topBarLabel({ run: { ...at(1, 'Supply'), phase: 'done', currentStep: -1 }, lookingBack: null, detourOpen: false })).toBe('Lesson complete')
  })
})

describe('escapeTarget', () => {
  it('Esc closes the chat, then the ribbon', () => {
    expect(escapeTarget({ menuOpen: false, chatOpen: true, lookBack: true, detourOpen: false })).toBe('chat')
    expect(escapeTarget({ menuOpen: false, chatOpen: false, lookBack: true, detourOpen: false })).toBe('lookBack')
    expect(escapeTarget({ menuOpen: false, chatOpen: false, lookBack: false, detourOpen: true })).toBe('detour')
    expect(escapeTarget({ menuOpen: false, chatOpen: false, lookBack: false, detourOpen: false })).toBeNull()
  })
  it('an open menu goes first', () => {
    expect(escapeTarget({ menuOpen: true, chatOpen: true, lookBack: true, detourOpen: true })).toBe('menu')
  })
})
