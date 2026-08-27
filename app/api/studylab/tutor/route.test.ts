// app/api/studylab/tutor/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { callGemma } from '@/lib/bedrock'
import { applyAction, draftPlan } from './dispatch'
import type { Database } from '@/lib/db'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'

const GAP = policyFor('gap')

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

function lockedRun(): LessonRun {
  const planned = proposePlan(emptyRun(GAP), [
    { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
    { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [],
      lockedBy: { subtopicId: 7, accuracy: 38 } },
  ])
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan(planned.run)
  if (!started.ok) throw new Error(started.reason)
  return started.run
}

beforeEach(() => vi.mocked(callGemma).mockReset())

describe('applyAction', () => {
  it('returns a refusal without spending a model call', async () => {
    // Someone hammering skip on a locked step should cost nothing.
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1',
      action: { type: 'skip', stepId: 'b' },
    })
    expect(result.refusal).toContain('38')
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('leaves the run untouched when it refuses', async () => {
    const run = lockedRun()
    const result = await applyAction({
      run, policy: GAP, userId: 'u1', action: { type: 'skip', stepId: 'b' },
    })
    expect(result.run).toEqual(run)
  })

  it('advances a beat and asks the teaching job for cards', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Here', actions: [], suggestions: [], awaitUser: true }),
    )
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run.beats).toBe(1)
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('changes pace without calling a model', async () => {
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1',
      action: { type: 'set_pace', pace: 'run' },
    })
    expect(result.run.pace).toBe('run')
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('leaves the run untouched when the model output cannot be parsed', async () => {
    // A retry has to be safe, so state must not advance on a failed parse.
    vi.mocked(callGemma).mockResolvedValue('not json at all')
    const run = lockedRun()
    const result = await applyAction({
      run, policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })
})

describe('draftPlan', () => {
  it('turns the model outline into steps with ids', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [
        { title: 'Atoms', goal: 'what an atom is' },
        { title: 'Bonding', goal: 'why atoms bond' },
      ] }),
    )
    const steps = await draftPlan({
      title: 'Chemistry', subject: 'Chemistry', policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(steps.map((s) => s.title)).toEqual(['Atoms', 'Bonding'])
    expect(new Set(steps.map((s) => s.id)).size).toBe(2)
  })

  it('drafts on the planning model, not the teaching one', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ steps: [{ title: 'A', goal: 'g' }] }))
    await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(vi.mocked(callGemma).mock.calls[0][1]).toMatchObject({
      model: 'google.gemma-3-27b-it',
    })
  })

  it('locks a drafted step the learner was measured weak on', async () => {
    // The whole point of attributing subtopics: the gap map decides what may
    // be skipped.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [{ title: 'Bonding', goal: 'g', subtopicId: 7 }] }),
    )
    const steps = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP, userId: 'u1',
      subtopics: [{ id: 7, name: 'Ionic bonding' }],
      database: dbWith([{ subtopic_id: 7, accuracy: 38 }]),
    })
    expect(steps[0].lockedBy).toEqual({ subtopicId: 7, accuracy: 38 })
  })

  it('returns nothing rather than a broken plan when the outline will not parse', async () => {
    vi.mocked(callGemma).mockResolvedValue('sorry, what?')
    const steps = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(steps).toEqual([])
  })
})

describe('test_out', () => {
  it('asks the check job for questions and returns them as a checkpoint', async () => {
    // Without this, "I know this" changes state and puts nothing on screen.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        questions: [
          { id: 'q1', format: 'mcq', prompt: 'Which bond?', options: ['Ionic', 'Covalent'], answer: 1 },
        ],
      }),
    )
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })

    expect(callGemma).toHaveBeenCalledOnce()
    const checkpoint = result.actions.find(
      (a): a is { type: string; questions: unknown[] } =>
        typeof a === 'object' && a !== null && (a as { type?: string }).type === 'checkpoint',
    )
    expect(checkpoint).toBeTruthy()
    expect(checkpoint!.questions).toHaveLength(1)
  })

  it('uses the check model, not the teaching one', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ questions: [] }))
    await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(vi.mocked(callGemma).mock.calls[0][1]).toMatchObject({
      model: 'amazon.nova-lite-v1:0',
    })
  })

  it('refuses a locked step without spending a model call', async () => {
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('gap'), userId: 'u1',
      action: { type: 'test_out', stepId: 'b', checkpointId: 'to-b' },
    })
    expect(result.refusal).toBeTruthy()
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('leaves the run untouched when the check will not parse', async () => {
    // A retry must be safe, exactly as it is for a teaching beat.
    vi.mocked(callGemma).mockResolvedValue('not json')
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })

  it('refuses rather than opening an empty check when the model returns no questions', async () => {
    // An open check with nothing to answer would strand the learner: the step
    // can never resolve because there is nothing to pass.
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ questions: [] }))
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })
})

describe('ask', () => {
  it('answers a question on the teaching model without advancing the lesson', async () => {
    // Asking is not progress: the step, the beat count and the plan all stay put.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Because electrons pair up.', actions: [], suggestions: [] }),
    )
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: 'why do atoms share electrons?' },
    })

    expect(result.say).toContain('electrons')
    expect(result.run.currentStep).toBe(run.currentStep)
    expect(result.run.beats).toBe(run.beats)
  })

  it('refuses an empty question without spending a model call', async () => {
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: '   ' },
    })
    expect(result.refusal).toBeTruthy()
    expect(callGemma).not.toHaveBeenCalled()
  })
})
