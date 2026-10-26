// lib/studylab/scenes.test.ts
import { describe, it, expect } from 'vitest'
import { settledSince, lessonFinished, lessonSummary, addActive, IDLE_CAP_MS } from './scenes'
import type { LessonRun, LessonStep, StepStatus } from './lessonRun'
import type { StudyNode } from './types'

const step = (id: string, status: StepStatus): LessonStep => ({ id, title: id.toUpperCase(), goal: 'g', status, cardIds: [] })

function run(statuses: StepStatus[], phase: LessonRun['phase'] = 'teaching'): LessonRun {
  return {
    phase, pace: 'step', currentStep: 0, beats: 0, awaiting: true,
    steps: statuses.map((s, i) => step(`s${i + 1}`, s)),
  }
}

describe('settledSince', () => {
  it('is nothing on arrival -- loading a lesson is not finishing a station', () => {
    expect(settledSince(null, run(['done', 'teaching']))).toEqual([])
  })

  it('names the steps that have just been passed or tested out of', () => {
    const before = run(['teaching', 'pending', 'pending'])
    const after = run(['done', 'known', 'teaching'])
    expect(settledSince(before, after).map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('ignores steps already settled and steps that are new', () => {
    const before = run(['done', 'teaching'])
    const after: LessonRun = { ...run(['done', 'teaching']), steps: [...run(['done', 'teaching']).steps, step('s9', 'done')] }
    expect(settledSince(before, after)).toEqual([])
  })
})

describe('lessonFinished', () => {
  it('is the moment the lesson ends, not every render after it', () => {
    expect(lessonFinished(run(['done'], 'teaching'), run(['done'], 'done'))).toBe(true)
    expect(lessonFinished(run(['done'], 'planning'), run(['done'], 'done'))).toBe(true)
    expect(lessonFinished(run(['done'], 'done'), run(['done'], 'done'))).toBe(false)
    expect(lessonFinished(null, run(['done'], 'done'))).toBe(false)
  })
})

describe('lessonSummary', () => {
  const node = (id: string, data: Partial<StudyNode['data']>, hidden = false): StudyNode => ({
    id, type: 'concept', position: { x: 0, y: 0 }, hidden, data: { kind: 'concept', ...data },
  })

  it('counts stations, tested-out steps, things practised and minutes', () => {
    const nodes = [
      node('q', { quiz: { checkpointId: 'c', gate: 'hard', state: 'correct', question: { id: 'q', format: 'mcq', prompt: 'p', options: ['a'], answer: 0 } } }),
      node('qx', { quiz: { checkpointId: 'c', gate: 'hard', state: 'incorrect', question: { id: 'q', format: 'mcq', prompt: 'p', options: ['a'], answer: 0 } } }),
      // Folded into a station: still practised.
      node('p', { practice: { state: 'correct' } }, true),
      node('px', { practice: { state: 'incorrect' } }),
      node('a', { activityState: { status: 'solved', attempts: 1, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: {} } }),
      node('m', { materialState: { status: 'solved', placement: {}, controls: {}, attempts: 1, rejectedMoves: [] } }),
      node('mx', { materialState: { status: 'in_progress', placement: {}, controls: {}, attempts: 1, rejectedMoves: [] } }),
    ]
    expect(lessonSummary(run(['done', 'known', 'done'], 'done'), nodes, 14.6 * 60_000)).toEqual({
      stations: 2, known: 1, practised: 4, minutes: 15,
    })
  })

  it('is all zeros for an empty lesson', () => {
    expect(lessonSummary(run([], 'done'), [], 0)).toEqual({ stations: 0, known: 0, practised: 0, minutes: 0 })
  })
})

describe('addActive', () => {
  it('adds the time since the last commit while the learner is active', () => {
    expect(addActive(1000, 10_000, 25_000, 24_000)).toBe(16_000)
  })

  it('stops counting two minutes after the last input', () => {
    expect(addActive(0, 0, 600_000, 30_000)).toBe(30_000 + IDLE_CAP_MS)
  })

  it('never takes time away', () => {
    expect(addActive(5000, 500_000, 600_000, 0)).toBe(5000)
  })
})
