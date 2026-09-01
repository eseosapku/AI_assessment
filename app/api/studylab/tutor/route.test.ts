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
// Test-out is offered on gap and homework lessons, never on one the learner
// started by naming a topic — these tests are about the check job, not that rule.
const TEST_OUTABLE = policyFor('homework')

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
      run: lockedRun(), policy: TEST_OUTABLE, userId: 'u1',
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
      run: lockedRun(), policy: TEST_OUTABLE, userId: 'u1',
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
      run, policy: TEST_OUTABLE, userId: 'u1',
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
      run, policy: TEST_OUTABLE, userId: 'u1',
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
      run, policy: TEST_OUTABLE, userId: 'u1',
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
  const jumpTo = (context: Record<string, unknown>) =>
    applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'jump', stepId: 'b' }, context,
    })

  it('reveals a step that already has cards, without regenerating it', async () => {
    // Going back to re-read should find what was read, not a fresh explanation
    // of the same thing — and not cost a paid call to say it.
    const result = await jumpTo({
      board: { cards: [{ id: 'b1', title: 'Bonding basics', step: 2, kind: 'concept' }] },
    })
    expect(callGemma).not.toHaveBeenCalled()
    expect(result.run.currentStep).toBe(1)
  })

  it('says what it revealed, so the click is not silent', async () => {
    const result = await jumpTo({
      board: { cards: [{ id: 'b1', title: 'Bonding basics', step: 2, kind: 'concept' }] },
    })
    expect(result.ack).toContain('Back on step 2, Bonding')
    expect(result.ack).toContain('card is on the board')
  })

  it('teaches a step that has never been built, rather than waiting for Continue', async () => {
    // The rail highlight moving is not feedback. Landing on an empty step and
    // sitting there is indistinguishable from the click not registering.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Here is bonding.', actions: [], suggestions: [] }),
    )
    const result = await jumpTo({ board: { cards: [{ id: 'a1', title: 'Atoms', step: 1, kind: 'concept' }] } })
    expect(callGemma).toHaveBeenCalledOnce()
    expect(result.say).toBe('Here is bonding.')
  })
})

describe('a state-only action always says what it did', () => {
  const act = async (action: Parameters<typeof applyAction>[0]['action']) => {
    const result = await applyAction({
      run: lockedRun(), policy: policyFor('scratch'), userId: 'u1', action, context: {},
    })
    return result.ack ?? ''
  }

  it('names the new pace and what it changes', async () => {
    expect(await act({ type: 'set_pace', pace: 'run' })).toContain('whole steps')
    expect(await act({ type: 'set_pace', pace: 'step' })).toContain('one card at a time')
  })

  it('names the step a skip landed on', async () => {
    expect(await act({ type: 'skip', stepId: 'a' })).toContain('step 2, Bonding')
  })

  it('confirms a pause', async () => {
    expect(await act({ type: 'stop' })).toContain('Paused')
  })

  it('spends no model call to do it', async () => {
    await act({ type: 'set_pace', pace: 'run' })
    expect(callGemma).not.toHaveBeenCalled()
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
      run: lockedRun(), policy: TEST_OUTABLE, userId: 'u1',
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
      run: lockedRun(), policy: TEST_OUTABLE, userId: 'u1',
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
      run, policy: TEST_OUTABLE, userId: 'u1',
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

/**
 * The board is the context the teaching job cannot do without.
 *
 * These assert against the prompt string because the failure they guard was
 * invisible at every other level: the call succeeded, the JSON parsed, the run
 * advanced — and the model, told to "read the EXISTING CARDS list below" with
 * no list below it, rebuilt cards it had already made.
 */
describe('the teaching prompt carries the board', () => {
  const teachOnce = async (context: Record<string, unknown>) => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'ok', actions: [], suggestions: [] }),
    )
    await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context,
    })
    return String(vi.mocked(callGemma).mock.calls[0][0])
  }

  const board = {
    cards: [
      { id: 's1-intro', title: 'What subtext is', step: 1, kind: 'concept' },
      { id: 's1-royale', title: 'Royale with Cheese', step: 1, kind: 'callout' },
    ],
    checkedSteps: [1],
    recent: [{ role: 'assistant', text: "Let's look at an example of subtext." }],
  }

  it('lists every card already on the canvas, by id and title', async () => {
    const prompt = await teachOnce({ title: 'Tarantino dialogue', board })
    expect(prompt).toContain('s1-intro [concept] "What subtext is" (step 1)')
    expect(prompt).toContain('s1-royale [callout] "Royale with Cheese" (step 1)')
    expect(prompt).toContain('do NOT recreate any of these')
  })

  it('names the steps that already carry a checkpoint', async () => {
    const prompt = await teachOnce({ title: 'T', board })
    expect(prompt).toContain('STEPS ALREADY CHECKED (do NOT emit or announce another checkpoint for these): 1')
  })

  it('replays what it already said, so it does not say it again', async () => {
    const prompt = await teachOnce({ title: 'T', board })
    expect(prompt).toContain("You: Let's look at an example of subtext.")
  })

  it('states the whole plan and marks where the learner is', async () => {
    const prompt = await teachOnce({ title: 'T', board })
    expect(prompt).toContain('1. Atoms — g [YOU ARE HERE]')
  })

  it('tells the model which step number to stamp on its cards', async () => {
    const prompt = await teachOnce({ title: 'T', board })
    expect(prompt).toContain('Set "step": 1 on every card you create this turn.')
  })

  it('says so plainly when the board is empty, rather than omitting the section', async () => {
    const prompt = await teachOnce({ title: 'T' })
    expect(prompt).toContain('(none yet — this is the first card on the board)')
    expect(prompt).toContain('STEPS ALREADY CHECKED: none')
  })
})

/** The two paces have to differ in something the model can comply with. */
describe('pace changes the instruction, not just the wording', () => {
  const promptFor = async (pace: 'step' | 'run') => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    const run = { ...openRun(), pace }
    await applyAction({ run, policy: GAP, userId: null, action: { type: 'next_beat' }, context: {} })
    return String(vi.mocked(callGemma).mock.calls[0][0])
  }

  it('budgets one card per beat on "step"', async () => {
    expect(await promptFor('step')).toContain('add exactly ONE new card')
  })

  it('budgets the whole step, ending in a checkpoint, on "run"', async () => {
    const prompt = await promptFor('run')
    expect(prompt).toContain('Emit 3 or 4 cards')
    expect(prompt).toContain('then emit ONE checkpoint action')
  })
})

/**
 * A card that runs code has no business in a lesson that is not about code.
 *
 * The prompt says so plainly and the model produced a JavaScript card holding a
 * scene from Pulp Fiction anyway, Run button included. A rule the model can
 * ignore is not a rule.
 */
describe('runnable cards are gated on the lesson', () => {
  const teach = async (run: LessonRun, card: Record<string, unknown>) => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'here', actions: [{ type: 'createCard', id: 'c1', step: 1, ...card }] }),
    )
    const result = await applyAction({
      run, policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    return result.actions[0] as Record<string, unknown>
  }

  const writing = (): LessonRun => ({ ...openRun(), programming: false })

  it('turns a code card into a concept card in a writing lesson', async () => {
    const out = await teach(writing(), {
      card: 'code', title: 'Royale with Cheese', language: 'javascript',
      code: 'console.log("They got the metric system there.")',
    })
    expect(out.card).toBe('concept')
    expect(out.title).toBe('Royale with Cheese')
    // The print wrapper is a costume; the line underneath is the content.
    expect(out.body).toBe('They got the metric system there.')
    expect(out.language).toBeUndefined()
    expect(out.code).toBeUndefined()
  })

  it('keeps the card rather than dropping it, so the chat is not left narrating nothing', async () => {
    const out = await teach(writing(), { card: 'web', title: 'A scene', html: '<p>Say what again</p>' })
    expect(out.card).toBe('concept')
    expect(out.body).toBe('<p>Say what again</p>')
  })

  it('prefers an explicit body over the source when one is given', async () => {
    const out = await teach(writing(), {
      card: 'code', title: 'X', code: 'print("x")', body: 'The real explanation.',
    })
    expect(out.body).toBe('The real explanation.')
  })

  it('leaves other card types alone', async () => {
    const out = await teach(writing(), { card: 'concept', title: 'X', body: 'y' })
    expect(out.card).toBe('concept')
    expect(out.body).toBe('y')
  })

  it('allows code cards in a programming lesson', async () => {
    const out = await teach({ ...openRun(), programming: true }, {
      card: 'code', title: 'A loop', language: 'python', code: 'for i in range(3): print(i)',
    })
    expect(out.card).toBe('code')
    expect(out.code).toBe('for i in range(3): print(i)')
  })

  it('leaves a run drafted before the flag existed untouched', async () => {
    // Undefined means "not decided", not "not programming" — an old lesson
    // keeps behaving as it did rather than silently losing its code cards.
    const out = await teach(openRun(), { card: 'code', title: 'A loop', code: 'x = 1' })
    expect(out.card).toBe('code')
  })
})

/**
 * A step has to be able to end.
 *
 * "Add one card, then stop" has nothing to say once the goal is met, so the
 * lesson sat on step 1 beat after beat with no check and no way to finish it.
 */
describe('every step gets closed', () => {
  const promptAfter = async (pace: 'step' | 'run', beats: number, checkedSteps: number[] = []) => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    // beats is incremented by the transition, so seed one below the target.
    const run = { ...openRun(), pace, beats: beats - 1 }
    await applyAction({
      run, policy: GAP, userId: null, action: { type: 'next_beat' },
      context: { board: { checkedSteps } },
    })
    // The last call, not the first: a test that drives two turns would
    // otherwise assert twice against the same prompt.
    return String(vi.mocked(callGemma).mock.calls.at(-1)![0])
  }

  it('keeps teaching while the step is young', async () => {
    expect(await promptAfter('step', 1)).toContain('PACE — ONE BEAT')
    expect(await promptAfter('run', 1)).toContain('PACE — WHOLE STEP')
  })

  it('demands the check once a step has had enough turns', async () => {
    const late = await promptAfter('step', 3)
    expect(late).toContain('PACE — CLOSE THIS STEP')
    expect(late).toContain('The checkpoint is required.')
  })

  it('closes a run-pace step on the turn after it was built', async () => {
    expect(await promptAfter('run', 2)).toContain('PACE — CLOSE THIS STEP')
  })

  it('does not ask for a second check on a step that already has one', async () => {
    // Asking again is how a learner gets tested twice on the same idea.
    expect(await promptAfter('step', 5, [1])).toContain('PACE — ONE BEAT')
  })
})

/**
 * The card in the screenshot: a screenwriting lesson whose "example" was four
 * console.log calls and two // comments. Converting it to a concept card kept
 * the content and kept the costume with it.
 */
describe('prose dressed as code is undressed, not just relabelled', () => {
  const convert = async (code: string) => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'here',
        actions: [{ type: 'createCard', id: 'c1', step: 1, card: 'code', title: 'Example', code }],
      }),
    )
    const result = await applyAction({
      run: { ...openRun(), programming: false }, policy: GAP, userId: null,
      action: { type: 'next_beat' }, context: {},
    })
    return (result.actions[0] as Record<string, unknown>).body as string
  }

  it('recovers dialogue from a run of print statements', async () => {
    const body = await convert(
      [
        "// This is an example of Tarantino's dialogue style.",
        'console.log("Mr. Pink: You know what I hate?");',
        'console.log("Mr. White: Why? What\'s wrong with Mr. Pink?");',
      ].join('\n'),
    )
    expect(body).toBe(
      [
        "This is an example of Tarantino's dialogue style.",
        'Mr. Pink: You know what I hate?',
        "Mr. White: Why? What's wrong with Mr. Pink?",
      ].join('\n'),
    )
    expect(body).not.toContain('console.log')
    expect(body).not.toContain('//')
  })

  it('handles print and single quotes too', async () => {
    expect(await convert("print('A line of prose.')")).toBe('A line of prose.')
  })

  it('leaves a snippet with real code in it exactly as it was', async () => {
    // Better an oddly placed card than one silently mangled.
    const real = 'for (const x of xs) {\n  console.log("x is " + x);\n}'
    expect(await convert(real)).toBe(real)
  })

  it('leaves an unterminated string alone rather than swallowing the line', async () => {
    const broken = 'console.log("no closing quote);'
    expect(await convert(broken)).toBe(broken)
  })
})
