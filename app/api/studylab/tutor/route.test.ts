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
import { emptyRun, proposePlan, acceptPlan, beginCheck, type LessonRun } from '@/lib/studylab/lessonRun'

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

/** A run mid-lesson with a single step, teaching it. */
function openRun(): LessonRun {
  const planned = proposePlan(emptyRun(GAP), [
    { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
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
    const { steps } = await draftPlan({
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
    const { steps } = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP, userId: 'u1',
      subtopics: [{ id: 7, name: 'Ionic bonding' }],
      database: dbWith([{ subtopic_id: 7, accuracy: 38 }]),
    })
    expect(steps[0].lockedBy).toEqual({ subtopicId: 7, accuracy: 38 })
  })

  it('returns nothing rather than a broken plan when the outline will not parse', async () => {
    vi.mocked(callGemma).mockResolvedValue('sorry, what?')
    const { steps } = await draftPlan({
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

  it('refuses rather than opening a check the canvas cannot render', async () => {
    // A question with no usable format (no options, no pairs, no goal) passes
    // a bare "has a prompt" check but fails the canvas's own isValidQuestion —
    // the canvas would drop it silently, leaving openCheck stuck forever with
    // nothing on screen to resolve it.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ questions: [{ id: 'q1', prompt: 'Which bond?' }] }),
    )
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })
})

describe('checkpoint emitted by a teaching turn', () => {
  // FINDING 1: beginCheck is only ever called from requestTestOut in
  // production. But the everyday flow is a next_beat/jump teaching call
  // emitting its own { type: 'checkpoint' } action once a step has been
  // taught — nothing opened a check for that, so answer_check always refused
  // with "There is no check open" and a step could never reach 'done'.

  it('opens the checkpoint a next_beat teaching turn emits, so answer_check can later resolve it', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Try this.',
        actions: [{ type: 'checkpoint', id: 'cp-1', step: 1, gate: 'hard', questions: [] }],
        suggestions: [],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run.openCheck).toEqual({
      stepId: 'a', checkpointId: 'cp-1', kind: 'checkpoint', gate: 'hard',
    })
  })

  it('resolves via answer_check: the step finishes and the lesson advances — this is the loop that was broken', async () => {
    vi.mocked(callGemma).mockResolvedValueOnce(
      JSON.stringify({
        say: 'Try this.',
        actions: [{ type: 'checkpoint', id: 'cp-1', step: 1, gate: 'hard', questions: [] }],
        suggestions: [],
      }),
    )
    const opened = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(opened.run.openCheck).toBeTruthy()

    // Single-step run: once this resolves, currentStep goes to -1 and no
    // further teaching call is needed, so no second callGemma mock is set up.
    const result = await applyAction({
      run: opened.run, policy: GAP, userId: 'u1',
      action: { type: 'answer_check', passed: true },
    })

    expect(result.run.openCheck).toBeUndefined()
    expect(result.run.steps[0].status).toBe('done')
    expect(result.run.currentStep).toBe(-1)
  })

  it('leaves an already-open check untouched and drops the duplicate checkpoint action', async () => {
    const run = openRun()
    const withCheck = beginCheck(run, 'a', 'existing-cp', 'testout', 'soft')
    if (!withCheck.ok) throw new Error(withCheck.reason)

    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Try this.',
        actions: [{ type: 'checkpoint', id: 'cp-2', step: 1, gate: 'hard', questions: [] }],
        suggestions: [],
      }),
    )
    const result = await applyAction({
      run: withCheck.run, policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })

    expect(result.run.openCheck).toEqual(withCheck.run.openCheck)
    expect(result.actions).toEqual([])
  })

  it('resolves an out-of-range checkpoint step against the current step rather than dropping it', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Try this.',
        actions: [{ type: 'checkpoint', id: 'cp-3', step: 99, gate: 'soft', questions: [] }],
        suggestions: [],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run.openCheck).toEqual({
      stepId: 'a', checkpointId: 'cp-3', kind: 'checkpoint', gate: 'soft',
    })
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

describe('the planning exchange', () => {
  it('asks at most two questions alongside the first draft', async () => {
    // The half that was missing. A plan the learner cannot respond to is an
    // announcement, not a negotiation.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        steps: [{ title: 'Atoms', goal: 'g' }],
        questions: ['Exam prep or understanding?', 'Done this before?', 'A third one'],
      }),
    )
    const { questions } = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(questions).toEqual(['Exam prep or understanding?', 'Done this before?'])
  })

  it('asks for questions on a first draft and not on a re-draft', async () => {
    // Asking twice turns a setup exchange into an interrogation.
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ steps: [{ title: 'A', goal: 'g' }] }))
    await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).toContain('AT MOST TWO')

    vi.mocked(callGemma).mockClear()
    await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP, userId: 'u1',
      subtopics: [], database: dbWith([]), answer: 'exam in two weeks',
    })
    const redraft = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(redraft).not.toContain('AT MOST TWO')
    expect(redraft).toContain('exam in two weeks')
  })

  it('survives a model that returns no questions at all', async () => {
    // None is a legitimate answer when the plan genuinely turns on nothing.
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ steps: [{ title: 'A', goal: 'g' }] }))
    const { steps, questions } = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(steps).toHaveLength(1)
    expect(questions).toEqual([])
  })

  it('discards a question that is only whitespace', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [{ title: 'A', goal: 'g' }], questions: ['  ', 'Real one?'] }),
    )
    const { questions } = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(questions).toEqual(['Real one?'])
  })
})

describe('jump', () => {
  it('reveals an earlier step without regenerating it', async () => {
    // Going back to re-read should find what was read, not a fresh explanation
    // of the same thing — and not cost a paid call to say it.
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'jump', stepId: 'b' },
    })
    expect(callGemma).not.toHaveBeenCalled()
    expect(result.run.currentStep).toBe(1)
  })
})

describe('check-question field names', () => {
  it('accepts the field names a model actually reaches for', async () => {
    // Nova returns "type"/"question" every time — reasonable words for those
    // things, and the reason test-out failed twice in a row in the browser.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        questions: [
          { id: 'q1', type: 'mcq', question: 'Faster or slower?', options: ['Faster', 'Slower'], answer: 1 },
        ],
      }),
    )
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    const checkpoint = result.actions.find(
      (a): a is { type: string; questions: unknown[] } =>
        typeof a === 'object' && a !== null && (a as { type?: string }).type === 'checkpoint',
    )
    expect(checkpoint?.questions).toHaveLength(1)
  })

  it('gives a question with no id one, rather than discarding it', async () => {
    // Losing a good question over bookkeeping is the worst reason to fail.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ questions: [{ format: 'short', prompt: 'Why does light bend?' }] }),
    )
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(result.refusal).toBeUndefined()
  })

  it('still refuses when the questions are genuinely unusable', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ questions: [{ id: 'q1', prompt: 'no format at all' }] }),
    )
    const run = lockedRun()
    const result = await applyAction({
      run, policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })
})

describe('subtopic attribution', () => {
  it('discards an id that was never offered', async () => {
    // Given no catalogue, the model numbers steps 1, 2, 3 — and those collide
    // with real subtopic ids from other subjects. That is how a lesson on
    // Tarantino dialogue told a learner they had scored 29% on it, borrowing a
    // Biology classification score.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [{ title: "Tarantino's style", goal: 'g', subtopicId: 1 }] }),
    )
    const { steps } = await draftPlan({
      title: 'Writing dialogue', subject: null, policy: policyFor('scratch'),
      userId: 'u1', subtopics: [], database: dbWith([{ subtopic_id: 1, accuracy: 29 }]),
    })
    expect(steps[0].subtopicId).toBeUndefined()
    expect(steps[0].lockedBy).toBeUndefined()
  })

  it('keeps an id that was offered', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [{ title: 'Ionic bonding', goal: 'g', subtopicId: 7 }] }),
    )
    const { steps } = await draftPlan({
      title: 'Chemistry', subject: null, policy: policyFor('gap'), userId: 'u1',
      subtopics: [{ id: 7, name: 'Ionic bonding' }],
      database: dbWith([{ subtopic_id: 7, accuracy: 38 }]),
    })
    expect(steps[0].subtopicId).toBe(7)
    expect(steps[0].lockedBy).toEqual({ subtopicId: 7, accuracy: 38 })
  })

  it('never asks for an id when there is no catalogue to pick from', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ steps: [{ title: 'A', goal: 'g' }] }))
    await draftPlan({
      title: 'Writing dialogue', subject: null, policy: policyFor('scratch'),
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).not.toContain('subtopicId')
  })
})
