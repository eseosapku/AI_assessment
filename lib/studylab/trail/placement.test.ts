// lib/studylab/trail/placement.test.ts
import { describe, it, expect } from 'vitest'
import { blockSize } from '../blocks'
import type { LessonRun } from '../lessonRun'
import type { StudyNode } from '../types'
import { cardTitle, assignBlocks, isTrailCard, placeCards, trailSpotlight, type PlacementInput } from './placement'
import { focusOf, pinnedFocus, syncQueue, waitingIds } from './queue'
import type { CardInput } from './types'

const node = (id: string, step: number | undefined, over: Record<string, unknown> = {}) =>
  ({ id, type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', title: id, ...(step === undefined ? {} : { step }) }, ...over }) as unknown as StudyNode
const runAt = (current: number, statuses: string[], phase = 'teaching') =>
  ({ phase, pace: 'step', recipe: 'station', currentStep: current, beats: 0, awaiting: false, steps: statuses.map((status, i) => ({ id: `s${i}`, title: `Station ${i}`, goal: '', status, cardIds: [] })) }) as unknown as LessonRun

describe('syncQueue', () => {
  it('a new burst becomes the queue', () => expect(syncQueue(null, ['a', 'b', 'c'])).toEqual({ ids: ['a', 'b', 'c'], at: 0 }))
  it('being sent to a card in the queue moves along it, keeping the rest', () =>
    expect(syncQueue({ ids: ['a', 'b', 'c'], at: 0 }, ['b'])).toEqual({ ids: ['a', 'b', 'c'], at: 1 }))
  it('a focus outside the queue replaces it', () => expect(syncQueue({ ids: ['a', 'b'], at: 1 }, ['z'])).toEqual({ ids: ['z'], at: 0 }))
  it('nothing in the spotlight clears it', () => expect(syncQueue({ ids: ['a'], at: 0 }, [])).toBeNull())
  it('the same spotlight leaves the queue as it is, so a re-render cannot rewind it', () => {
    const q = { ids: ['a', 'b', 'c'], at: 2 }
    expect(syncQueue(q, ['a', 'b', 'c'])).toEqual(q)
  })
})

describe('queue helpers', () => {
  it('reads the focus and what waits', () => {
    expect(focusOf({ ids: ['a', 'b', 'c'], at: 1 })).toBe('b')
    expect(waitingIds({ ids: ['a', 'b', 'c'], at: 1 })).toEqual(['c'])
    expect(focusOf(null)).toBeNull()
    expect(waitingIds(null)).toEqual([])
  })
})

describe('isTrailCard', () => {
  it('leaves out what the Trail never draws', () => {
    expect(isTrailCard(node('a', 1))).toBe(true)
    expect(isTrailCard(node('h', 1, { type: 'checkpointHeader' }))).toBe(false)
    expect(isTrailCard(node('g', 1, { type: 'stepGroup' }))).toBe(false)
  })
})

describe('trailSpotlight', () => {
  it('a check header never takes the focus; the newest real card does', () => {
    const nodes = [node('c1', 1), node('h1', 1, { type: 'checkpointHeader' })]
    expect(trailSpotlight({ nodes, run: runAt(0, ['teaching', 'pending', 'pending']), explicit: ['h1'] })).toEqual(['c1'])
  })
  it('keeps a burst in the order it was built', () => {
    const nodes = [node('a', 1), node('b', 1)]
    expect(trailSpotlight({ nodes, run: runAt(0, ['teaching', 'pending', 'pending']), explicit: ['a', 'b'] })).toEqual(['a', 'b'])
  })
  it('has nothing to show outside teaching', () => {
    expect(trailSpotlight({ nodes: [node('a', 1)], run: runAt(-1, [], 'planning'), explicit: [] })).toEqual([])
  })
})

describe('placeCards', () => {
  const ids = (cs: CardInput[]) => cs.map((c) => c.id)
  const place = (over: Partial<PlacementInput>) => placeCards({ nodes: [], run: null, queue: null, detours: [], openDetour: null, blocks: {}, sizes: {}, interlude: null, notes: [], ...over })
  const run = runAt(1, ['done', 'teaching', 'pending'])

  it('one focus; the rest of the burst waits unplaced; earlier cards are finished', () => {
    const p = place({ run, nodes: [node('old', 2), node('a', 2), node('b', 2), node('c', 2)], queue: { ids: ['a', 'b', 'c'], at: 1 } })
    expect(p.focus).toBe('b')
    expect(p.waiting).toEqual(['c'])
    expect(ids(p.stations[1].finished)).toEqual(['old', 'a'])
    expect(p.drawn[0]).toBe('b')
    expect(p.drawn).not.toContain('c')
  })

  it('a done station files its cards, including cards the classic view folded and hid', () => {
    const p = place({ run, nodes: [node('c1', 1, { hidden: true }), node('step-1', 1, { type: 'stepGroup', data: { kind: 'stepGroup', step: 1, cardIds: ['c1'] } })] })
    expect(ids(p.stations[0].filed)).toEqual(['c1'])
    expect(p.drawn).toContain('c1')
    expect(p.drawn).not.toContain('step-1')
  })

  it('a hidden card in no group (a failed check) is not drawn', () => {
    expect(place({ run, nodes: [node('q1', 2, { hidden: true })] }).drawn).not.toContain('q1')
  })

  it('a check header is not drawn', () => {
    expect(place({ run, nodes: [node('h1', 2, { type: 'checkpointHeader' })] }).drawn).toEqual([])
  })

  it('a test-out station is done with no cards', () => {
    const p = place({ run: runAt(1, ['known', 'teaching', 'pending']) })
    expect(p.stations[0]).toMatchObject({ state: 'done', filed: [] })
  })

  it('a jump back: the current plot is earlier, later done plots stay done', () => {
    const p = place({ run: runAt(0, ['teaching', 'done', 'pending']) })
    expect(p.stations.map((s) => s.state)).toEqual(['current', 'done', 'future'])
  })

  it('cards in a station not yet done, and not current, are filed there', () => {
    const p = place({ run: runAt(0, ['teaching', 'pending', 'pending']), nodes: [node('later', 3)] })
    expect(ids(p.stations[2].filed)).toEqual(['later'])
  })

  it('a card with no station goes to the current one, and a card past the plan to the last', () => {
    const p = place({ run, nodes: [node('nostep', undefined), node('past', 9)] })
    expect(ids(p.stations[1].finished)).toEqual(['nostep'])
    expect(ids(p.stations[2].filed)).toEqual(['past'])
  })

  it('cards the learner adds stay in the station they were made in', () => {
    const p = place({ run: runAt(2, ['done', 'done', 'teaching']), nodes: [node('free-note-1', undefined, { source: 'freeform', type: 'note' })], blocks: { 'free-note-1': 0 } })
    expect(ids(p.stations[0].filed)).toEqual(['free-note-1'])
    expect(assignBlocks([node('free-note-2', undefined, { source: 'freeform', type: 'note' })], {}, 2)).toEqual({ 'free-note-2': 2 })
    expect(assignBlocks([node('free-note-2', undefined, { source: 'freeform', type: 'note' })], { 'free-note-2': 0 }, 2)).toEqual({ 'free-note-2': 0 })
    expect(assignBlocks([node('a', 1)], {}, 2)).toEqual({})
  })

  it('detour cards leave their station: the open one is in focus, closed ones are filed', () => {
    const nodes = [node('a', 2), node('d1', 2), node('d2', 2)]
    const detours = [{ id: 'x', station: 1, cardIds: ['d1'] }, { id: 'y', station: 1, cardIds: ['d2'] }]
    const p = place({ run, nodes, detours, openDetour: 'x', queue: { ids: ['d1'], at: 0 } })
    expect(ids(p.stations[1].finished)).toEqual(['a'])
    expect(p.detours[0].focus?.id).toBe('d1')
    expect(ids(p.detours[1].filed)).toEqual(['d2'])
    expect(p.stations[1].focus).toBeNull()
  })

  it('while a detour is open, the burst the learner left keeps waiting', () => {
    const nodes = [node('a', 2), node('b', 2), node('c', 2), node('d1', 2)]
    const detours = [{ id: 'x', station: 1, cardIds: ['d1'], returnTo: { ids: ['a', 'b', 'c'], at: 1 } }]
    const p = place({ run, nodes, detours, openDetour: 'x', queue: { ids: ['d1'], at: 0 } })
    expect(p.drawn).not.toContain('c')
    expect(ids(p.stations[1].finished)).toEqual(['a', 'b'])
    expect(p.waiting).toEqual(['c'])
  })

  it('a burst left behind stops waiting once its detour has closed', () => {
    const nodes = [node('a', 2), node('c', 2), node('d1', 2)]
    const detours = [{ id: 'x', station: 1, cardIds: ['d1'], returnTo: { ids: ['a', 'c'], at: 0 } }]
    const p = place({ run, nodes, detours, openDetour: null, queue: { ids: ['a', 'c'], at: 1 } })
    expect(p.focus).toBe('c')
    expect(ids(p.stations[1].finished)).toEqual(['a'])
  })

  it('an interlude: the done station is done, the next is `next`, its cards all wait', () => {
    const p = place({ run, nodes: [node('n1', 2)], queue: { ids: ['n1'], at: 0 }, interlude: { done: 0, next: 1 } })
    expect(p.stations[1]).toMatchObject({ state: 'next', focus: null })
    expect(p.focus).toBeNull()
    expect(p.waiting).toEqual(['n1'])
    expect(p.drawn).not.toContain('n1')
  })

  it('planning: plots come from the plan, the first is `next`, the rest future', () => {
    const p = place({ run: runAt(-1, [], 'planning'), planSteps: [{ id: 's1', title: 'A', locked: true }, { id: 's2', title: 'B' }] })
    expect(p.stations.map((s) => s.state)).toEqual(['next', 'future'])
    expect(p.stations[0]).toMatchObject({ title: 'A', locked: true })
  })

  it('a finished lesson is every plot done', () => {
    const p = place({ run: runAt(-1, ['done', 'known', 'done'], 'done'), nodes: [node('c1', 2)] })
    expect(p.stations.map((s) => s.state)).toEqual(['done', 'done', 'done'])
    expect(ids(p.stations[1].filed)).toEqual(['c1'])
  })

  it('notes count on their station', () => {
    expect(place({ run, notes: [{ station: 1 }, { station: 1 }] }).stations[1].notes).toBe(2)
  })

  it('a focus id that is not on the board is no focus at all', () => {
    expect(place({ run, nodes: [], queue: { ids: ['gone'], at: 0 } }).focus).toBeNull()
  })

  it('falls back to blockSize when a card is unmeasured', () => {
    const p = place({ run, nodes: [node('a', 2, { type: 'concept' })], queue: { ids: ['a'], at: 0 } })
    expect(p.stations[1].focus?.natural).toEqual(blockSize('concept'))
    const measured = place({ run, nodes: [node('a', 2)], queue: { ids: ['a'], at: 0 }, sizes: { a: { w: 500, h: 321 } } })
    expect(measured.stations[1].focus?.natural).toEqual({ w: 500, h: 321 })
  })
})

describe('cardTitle', () => {
  const data = (d: object) => ({ data: d }) as never
  it('a card says its own title', () => expect(cardTitle(data({ title: 'Demand' }))).toBe('Demand'))
  it('a question card has no title, so it says its question', () => {
    expect(cardTitle(data({ quiz: { question: { prompt: 'Why does it fall?' } } }))).toBe('Why does it fall?')
  })
  it('a long one is cut short, and one with nothing to say still reads', () => {
    expect(cardTitle(data({ title: 'x'.repeat(90) })).length).toBeLessThanOrEqual(61)
    expect(cardTitle(data({}))).toBe('this card')
  })
})

describe('a check on reload', () => {
  const quiz = (id: string, state: string, checkpointId = 'cp') => node(id, 2, { type: 'quiz', data: { kind: 'quiz', step: 2, quiz: { checkpointId, state } } })
  const open = { ...runAt(1, ['done', 'teaching', 'pending']), openCheck: { checkpointId: 'cp' } } as LessonRun
  const place = (nodes: StudyNode[], ids: string[]) => placeCards({ nodes, run: open, queue: { ids, at: 0 }, detours: [], openDetour: null, blocks: {}, sizes: {}, interlude: null, notes: [] })

  it('a question not reached waits, unplaced, even with no queue holding it', () => {
    const p = place([quiz('q1', 'unanswered'), quiz('q2', 'unanswered')], ['q1'])
    expect(p.focus).toBe('q1')
    expect(p.waiting).toEqual(['q2'])
    expect(p.drawn).toEqual(['q1'])
  })
  it('a question already answered is finished, and so is any question of another check', () => {
    const p = place([quiz('q1', 'correct'), quiz('q2', 'unanswered'), quiz('old', 'unanswered', 'other')], ['q2'])
    expect(p.stations[1].finished.map((c) => c.id)).toEqual(['q1', 'old'])
  })
})

describe('pinnedFocus', () => {
  it('a focus arrived at by fallback is pinned, so answering it does not jump to the next card', () => {
    expect(pinnedFocus([], ['q1'])).toBe('q1')
  })
  it('a focus the lesson named needs no pin, and nothing in view has nothing to pin', () => {
    expect(pinnedFocus(['q1'], ['q1'])).toBeNull()
    expect(pinnedFocus([], [])).toBeNull()
  })
})

describe('trailSpotlight with closed detours', () => {
  const run = runAt(1, ['done', 'teaching', 'pending'])
  it('the fallback passes over a card filed on a detour', () => {
    const nodes = [node('real', 2), node('side', 2)]
    expect(trailSpotlight({ nodes, run, explicit: [], skip: new Set(['side']) })).toEqual(['real'])
  })
  it('but a card the lesson names is still shown', () => {
    const nodes = [node('real', 2), node('side', 2)]
    expect(trailSpotlight({ nodes, run, explicit: ['side'], skip: new Set(['side']) })).toEqual(['side'])
  })
})
