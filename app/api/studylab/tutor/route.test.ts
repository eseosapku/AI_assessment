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
    expect(prompt).toContain('Then emit ONE checkpoint action')
    // A step teaching a method has to end with the learner doing one.
    expect(prompt).toContain('a "practice" card')
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
  const card = (i: number, step = 1) => ({ id: `c${i}`, title: `Card ${i}`, step, kind: 'concept' })

  const promptWith = async (
    pace: 'step' | 'run',
    cards: number,
    checkedSteps: number[] = [],
  ) => {
    // Reset here, not just per test: several of these drive two turns.
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    await applyAction({
      run: { ...openRun(), pace }, policy: GAP, userId: null, action: { type: 'next_beat' },
      context: {
        board: {
          cards: Array.from({ length: cards }, (_, i) => card(i)),
          checkedSteps,
        },
      },
    })
    // The teaching prompt is the first call. A full step now triggers a
    // second one — the check the tutor was told to write and didn't.
    return String(vi.mocked(callGemma).mock.calls[0][0])
  }

  it('keeps teaching while the step is still thin', async () => {
    expect(await promptWith('step', 1)).toContain('PACE — ONE BEAT')
    expect(await promptWith('run', 0)).toContain('PACE — WHOLE STEP')
  })

  it('demands the check once the step has enough cards on it', async () => {
    // Counted on the board, not in beats: accept_plan teaches a turn without
    // incrementing beats, so at run pace a step reached ten cards before its
    // check appeared.
    const late = await promptWith('step', 3)
    expect(late).toContain('PACE — CLOSE THIS STEP')
    expect(late).toContain('The checkpoint is required.')
  })

  it('closes a run-pace step as soon as one turn has filled it', async () => {
    expect(await promptWith('run', 4)).toContain('PACE — CLOSE THIS STEP')
  })

  it('counts only the cards on THIS step', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    await applyAction({
      run: openRun(), policy: GAP, userId: null, action: { type: 'next_beat' },
      context: { board: { cards: [card(1, 2), card(2, 2), card(3, 2), card(4, 1)] } },
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).toContain('PACE — ONE BEAT')
  })

  it('does not re-ask while nothing new has been taught since the last check', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: null,
      action: { type: 'next_beat' },
      context: { board: { cards: [card(1)], checkedSteps: [1], cardsSinceCheck: { 1: 0 } } },
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).toContain('PACE — ONE BEAT')
  })

  it('asks again as soon as the missed point has been re-taught', async () => {
    // A failed check leaves the step open. Treating "already checked" as
    // "finished with checking" left the tutor re-teaching one idea forever
    // with no way to reach the next step.
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: null,
      action: { type: 'next_beat' },
      context: { board: { cards: [card(1), card(2)], checkedSteps: [1], cardsSinceCheck: { 1: 1 } } },
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).toContain('PACE — CLOSE THIS STEP')
  })
})

/**
 * Asking was never enough: told plainly to close the step, the model often
 * returns three more cards instead.
 */
describe('a full step gets a check whether the model writes one or not', () => {
  const teachReturning = async (actions: unknown[], cards: number, checkQuestions?: unknown) => {
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 'more cards', actions }))
      .mockResolvedValueOnce(
        JSON.stringify({
          questions: checkQuestions ?? [
            { id: 'q1', format: 'mcq', prompt: 'Which?', options: ['a', 'b'], answer: 0 },
          ],
        }),
      )
    return applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
      context: {
        board: {
          cards: Array.from({ length: cards }, (_, i) => ({
            id: `c${i}`, title: `Card ${i}`, step: 1, kind: 'concept',
          })),
        },
      },
    })
  }

  it('writes the check itself when the model ignored the instruction', async () => {
    const result = await teachReturning([], 3)
    const cp = result.actions.find(
      (a) => (a as { type?: string }).type === 'checkpoint',
    ) as { questions: unknown[]; gate: string; step: number } | undefined
    expect(cp).toBeDefined()
    expect(cp!.questions).toHaveLength(1)
    expect(cp!.gate).toBe('hard')
    expect(cp!.step).toBe(1)
    // And the run records it, or nothing could ever answer it.
    expect(result.run.openCheck?.stepId).toBe('a')
  })

  it("leaves the model's own checkpoint alone rather than adding a second", async () => {
    const own = [{ type: 'checkpoint', id: 'cp-mine', step: 1, gate: 'hard', questions: [] }]
    const result = await teachReturning(own, 4)
    expect(result.actions.filter((a) => (a as { type?: string }).type === 'checkpoint')).toHaveLength(1)
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('does not close a step that is still thin', async () => {
    const result = await teachReturning([], 1)
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(false)
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('counts the cards made this turn, not just the ones already there', async () => {
    // Two on the board plus two created now is a full step.
    const made = [
      { type: 'createCard', id: 'n1', card: 'concept', title: 'New 1', step: 1 },
      { type: 'createCard', id: 'n2', card: 'concept', title: 'New 2', step: 1 },
    ]
    const result = await teachReturning(made, 2)
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(true)
  })

  it('leaves the run untouched when the check will not parse', async () => {
    // An open check with nothing to answer strands the learner far worse than
    // a step that runs one card long.
    const result = await teachReturning([], 3, [{ nonsense: true }])
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(false)
    expect(result.run.openCheck).toBeUndefined()
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

/**
 * A finished lesson is exactly when a learner asks a follow-up.
 *
 * `ask` looked up `steps[currentStep]`, which is -1 once a run is done, and
 * returned an empty result: no card, no reply, not even a refusal. The question
 * simply vanished.
 */
describe('asking after the lesson has finished', () => {
  const finishedRun = (): LessonRun => {
    const run = openRun()
    return {
      ...run,
      phase: 'done',
      currentStep: -1,
      steps: run.steps.map((s) => ({ ...s, status: 'done' as const })),
    }
  }

  it('answers instead of going silent', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Here you go.', actions: [], suggestions: [] }),
    )
    const result = await applyAction({
      run: finishedRun(), policy: GAP, userId: null,
      action: { type: 'ask', question: 'Can you give me another example?' },
      context: {},
    })
    expect(result.say).toBe('Here you go.')
    expect(result.refusal).toBeUndefined()
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('tells the model the lesson is over, so it does not restart it', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'ok', actions: [] }))
    await applyAction({
      run: finishedRun(), policy: GAP, userId: null,
      action: { type: 'ask', question: 'Why?' }, context: {},
    })
    const prompt = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(prompt).toContain('The lesson is FINISHED')
    expect(prompt).toContain('do not emit a checkpoint')
  })

  it('still refuses when there is no lesson at all', async () => {
    const empty = { ...openRun(), steps: [], currentStep: -1, phase: 'done' as const }
    const result = await applyAction({
      run: empty, policy: GAP, userId: null,
      action: { type: 'ask', question: 'Anything?' }, context: {},
    })
    expect(result.refusal).toContain('no lesson here yet')
    expect(callGemma).not.toHaveBeenCalled()
  })
})

describe('a question never puts a gate in front of the learner', () => {
  it('drops a checkpoint the model attached to an answer', async () => {
    // The check would render on the canvas with nothing in the run to resolve
    // it, so Continue would block on a quiz that answering could not clear.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Here is an example.',
        actions: [
          { type: 'createCard', id: 'x1', card: 'concept', title: 'Example', body: 'b', step: 1 },
          { type: 'checkpoint', id: 'cp-sneaky', step: 1, gate: 'hard', questions: [] },
        ],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: null,
      action: { type: 'ask', question: 'Give me an example?' }, context: {},
    })
    expect(result.actions).toHaveLength(1)
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(false)
    expect(result.run.openCheck).toBeUndefined()
  })
})

/**
 * Closing a step and testing out of one are different questions, and they were
 * asking for the same thing: three questions landed on a learner who had just
 * read three cards.
 */
describe('a check is sized to why it is being written', () => {
  const promptFor = async (drive: 'close' | 'testout') => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 'taught', actions: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }],
        }),
      )

    if (drive === 'close') {
      await applyAction({
        run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
        context: {
          board: {
            cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
          },
        },
      })
      // The teaching call is first; the check the tutor failed to write is second.
      return String(vi.mocked(callGemma).mock.calls[1][0])
    }

    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }],
      }),
    )
    await applyAction({
      run: openRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' }, context: {},
    })
    return String(vi.mocked(callGemma).mock.calls[0][0])
  }

  it('asks for one question when it is only closing a step', async () => {
    const prompt = await promptFor('close')
    expect(prompt).toContain('ONE question, or two at the very most')
    expect(prompt).not.toContain('Two or three questions')
  })

  it('asks for more when the learner claims to know the whole step', async () => {
    const prompt = await promptFor('testout')
    expect(prompt).toContain('Two or three questions')
  })
})

/**
 * The diagram card is retired. Of the 42 on real boards, 26 carried no drawing
 * at all — a titled box saying nothing. The renderer stays so those boards keep
 * working; nothing new arrives as one.
 */
describe('the retired diagram card', () => {
  const teach = async (run: LessonRun, card: Record<string, unknown>) => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'here', actions: [{ type: 'createCard', id: 'd1', step: 1, ...card }] }),
    )
    const result = await applyAction({
      run, policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    return result.actions[0] as Record<string, unknown>
  }

  it('becomes a mermaid card when it carries diagram syntax', async () => {
    const out = await teach(openRun(), {
      card: 'diagram', title: 'A tree', mermaid: 'graph TD; A-->B',
    })
    expect(out.card).toBe('mermaid')
    expect(out.mermaid).toBe('graph TD; A-->B')
  })

  it('becomes a concept card when it carries nothing but words', async () => {
    const out = await teach(openRun(), {
      card: 'diagram', title: 'Supply and demand', body: 'The curves cross at equilibrium.',
    })
    expect(out.card).toBe('concept')
    expect(out.body).toBe('The curves cross at equilibrium.')
    expect(out.svg).toBeUndefined()
  })

  it('applies in a programming lesson too, where the runnable-card rule is off', async () => {
    const out = await teach({ ...openRun(), programming: true }, {
      card: 'diagram', title: 'Call stack', body: 'Frames stack up.',
    })
    expect(out.card).toBe('concept')
  })

  it('leaves every other card type alone', async () => {
    const out = await teach(openRun(), { card: 'table', title: 'T', rows: [['a']] })
    expect(out.card).toBe('table')
  })
})

describe('closing a step asks for practice first', () => {
  it('requests a practice card before the checkpoint on a method step', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: null,
      action: { type: 'next_beat' },
      context: {
        board: {
          cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
        },
      },
    })
    const prompt = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(prompt).toContain('PACE — CLOSE THIS STEP')
    expect(prompt).toContain('add ONE "practice"')
    // And it must not be forced onto a step that is purely descriptive.
    expect(prompt).toContain('purely descriptive step needs no practice card')
  })
})

/**
 * The transcript that prompted this: a check answered "1 of 2 right", then
 * fifteen more cards on one idea and no way to reach the next step.
 *
 * The step had a checkpoint on the board, so every later turn read it as
 * "already checked" and never asked again. Failing a question made the step
 * unfinishable.
 */
describe('a step whose check was failed', () => {
  const cardsOn = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' }))

  const turnAfterFailure = async (sinceCheck: number) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 're-taught', actions: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          questions: [{ id: 'q1', format: 'mcq', prompt: 'again?', options: ['a', 'b'], answer: 0 }],
        }),
      )
    return applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' },
      context: {
        board: { cards: cardsOn(4 + sinceCheck), checkedSteps: [1], cardsSinceCheck: { 1: sinceCheck } },
      },
    })
  }

  it('gets a fresh check once the missed point has been re-taught', async () => {
    const result = await turnAfterFailure(1)
    const cp = result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { id: string }
      | undefined
    expect(cp, 'the step was re-taught and never re-checked').toBeDefined()
    expect(result.run.openCheck).toBeDefined()
  })

  it('gives the retry an id of its own', async () => {
    // The reducer drops a checkpoint whose id is already on the board, so a
    // fixed id meant the retry rendered nothing and stranded the run.
    const a = await turnAfterFailure(1)
    const b = await turnAfterFailure(1)
    const idOf = (r: typeof a) =>
      (r.actions.find((x) => (x as { type?: string }).type === 'checkpoint') as { id: string }).id
    expect(idOf(a)).not.toBe(idOf(b))
    expect(idOf(a).startsWith('cp-a-')).toBe(true)
  })

  it('does not pounce before anything new has been said', async () => {
    const result = await turnAfterFailure(0)
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(false)
  })
})

describe('a turn that produces nothing', () => {
  it('says so rather than going silent', async () => {
    // The client only renders a message when there is one, so an empty turn
    // reached the learner as Continue doing absolutely nothing.
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '', actions: [] }))
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    expect(result.refusal).toBe('That did not come through. Try that again.')
  })

  it('leaves the run where it was, so pressing again retries the same turn', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: '   ', actions: [] }))
    const before = openRun()
    const result = await applyAction({
      run: before, policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    expect(result.run.beats).toBe(before.beats)
  })

  it('is happy with a turn that only speaks', async () => {
    // Answering a question without building anything is legitimate.
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'Yes — because of X.', actions: [] }))
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    expect(result.refusal).toBeUndefined()
    expect(result.say).toBe('Yes — because of X.')
  })
})

/**
 * The reducer drops a card the board already has — by id, and by title in any
 * word order. A turn made entirely of those builds nothing, and the learner
 * gets "here's the next idea" over an unchanged board.
 */
describe('a turn that only repeats what is already there', () => {
  const board = {
    cards: [
      { id: 'c1', title: 'The Male Gaze', step: 1, kind: 'concept' },
      { id: 'c2', title: 'Visual Spectacle vs Interiority', step: 1, kind: 'concept' },
    ],
  }

  const turnReturning = async (actions: unknown[]) => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'here it is', actions }))
    return applyAction({
      run: openRun(), policy: GAP, userId: null, action: { type: 'next_beat' },
      context: { board },
    })
  }

  it('refuses rather than pretending it taught something', async () => {
    const result = await turnReturning([
      { type: 'createCard', id: 'x1', card: 'concept', title: 'Interiority vs Visual Spectacle', step: 1 },
    ])
    expect(result.refusal).toContain('repeated myself')
    expect(result.actions).toEqual([])
  })

  it('catches a repeat by id as well as by title', async () => {
    const result = await turnReturning([
      { type: 'createCard', id: 'c1', card: 'concept', title: 'Something else entirely', step: 1 },
    ])
    expect(result.refusal).toBeTruthy()
  })

  it('leaves the run untouched, so pressing again is a real retry', async () => {
    const before = openRun()
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'again',
        actions: [{ type: 'createCard', id: 'c1', card: 'concept', title: 'The Male Gaze', step: 1 }],
      }),
    )
    const result = await applyAction({
      run: before, policy: GAP, userId: null, action: { type: 'next_beat' }, context: { board },
    })
    expect(result.run.beats).toBe(before.beats)
  })

  it('lets a turn through when even one card is new', async () => {
    const result = await turnReturning([
      { type: 'createCard', id: 'c1', card: 'concept', title: 'The Male Gaze', step: 1 },
      { type: 'createCard', id: 'n1', card: 'concept', title: 'Something genuinely new', step: 1 },
    ])
    expect(result.refusal).toBeUndefined()
  })

  it('lets a repeat through when the turn also closes the step', async () => {
    // Emitting the checkpoint is real work even if no card was new.
    const result = await turnReturning([
      { type: 'createCard', id: 'c1', card: 'concept', title: 'The Male Gaze', step: 1 },
      { type: 'checkpoint', id: 'cp-x', step: 1, gate: 'hard', questions: [
        { id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 },
      ] },
    ])
    expect(result.refusal).toBeUndefined()
  })
})

describe('a retry does not ask the same question again', () => {
  it('tells the check job what it has already asked', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 're-taught', actions: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          questions: [{ id: 'q1', format: 'mcq', prompt: 'a different angle?', options: ['a', 'b'], answer: 0 }],
        }),
      )
    await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' },
      context: {
        board: {
          cards: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
          checkedSteps: [1],
          cardsSinceCheck: { 1: 2 },
          askedByStep: { 1: ["Why might someone play the world's smallest violin?"] },
        },
      },
    })
    // The second call is the check being written.
    const checkPrompt = String(vi.mocked(callGemma).mock.calls[1][0])
    expect(checkPrompt).toContain('ALREADY asked')
    expect(checkPrompt).toContain("Why might someone play the world's smallest violin?")
    expect(checkPrompt).toContain('Not a rewording')
  })

  it("says nothing about repeats on a step's first check", async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 'taught', actions: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }],
        }),
      )
    await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' },
      context: {
        board: {
          cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
          cardsSinceCheck: { 1: 3 },
        },
      },
    })
    expect(String(vi.mocked(callGemma).mock.calls[1][0])).not.toContain('ALREADY asked')
  })
})
