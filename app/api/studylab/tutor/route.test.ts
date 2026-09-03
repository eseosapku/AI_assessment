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

/**
 * A step that has already had its cards, so an emitted checkpoint is allowed
 * to open. When a check may appear is decided by the board, not the model.
 */
const TAUGHT = {
  board: {
    cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
    cardsSinceCheck: { 1: 3 },
  },
}

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
        actions: [{ type: 'checkpoint', id: 'cp-1', step: 1, gate: 'hard', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] }],
        suggestions: [],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: TAUGHT,
    })
    // The id is the board's, not the model's — see "every check gets an id of
    // its own" below. What matters here is that the run and the action agree.
    const emitted = (result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { id: string } | undefined)?.id
    expect(result.run.openCheck).toEqual({
      stepId: 'a', checkpointId: emitted, kind: 'checkpoint', gate: 'hard',
    })
  })

  it('resolves via answer_check: the step finishes and the lesson advances — this is the loop that was broken', async () => {
    vi.mocked(callGemma).mockResolvedValueOnce(
      JSON.stringify({
        say: 'Try this.',
        actions: [{ type: 'checkpoint', id: 'cp-1', step: 1, gate: 'hard', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] }],
        suggestions: [],
      }),
    )
    const opened = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: TAUGHT,
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
        actions: [{ type: 'checkpoint', id: 'cp-2', step: 1, gate: 'hard', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] }],
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
        actions: [{ type: 'checkpoint', id: 'cp-3', step: 99, gate: 'soft', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] }],
        suggestions: [],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: TAUGHT,
    })
    const emitted = (result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { id: string } | undefined)?.id
    expect(result.run.openCheck).toEqual({
      stepId: 'a', checkpointId: emitted, kind: 'checkpoint', gate: 'soft',
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

  it('marks the cards it builds as asides, so they do not shorten the step', async () => {
    // The check arrives after a step's worth of teaching, counted off the
    // board — so three questions, each answered with a card, used to bring it
    // forward and the step got taught less than one nobody asked about.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'here',
        actions: [
          { type: 'createCard', id: 'a1', card: 'concept', title: 'Why b over 2', body: 'x', step: 1 },
          { type: 'connect', from: 'c1', to: 'a1' },
        ],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: 'why halve b?' },
    })
    const [card, edge] = result.actions as Record<string, unknown>[]
    expect(card.aside).toBe(true)
    // Only cards carry it; nothing else is counted anyway.
    expect(edge.aside).toBeUndefined()
  })

  it('does not let a teaching turn claim the flag for itself', async () => {
    // It decides when a step is finished being taught, so it is not the
    // model's to set.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'here',
        actions: [{ type: 'createCard', id: 'c9', card: 'concept', title: 'Rates', body: 'x', step: 1, aside: true }],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: {},
    })
    expect((result.actions[0] as Record<string, unknown>).aside).toBeUndefined()
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
    const own = [{ type: 'checkpoint', id: 'cp-mine', step: 1, gate: 'hard', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] }]
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
          { type: 'checkpoint', id: 'cp-sneaky', step: 1, gate: 'hard', questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }] },
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
    expect(prompt).toContain('EXACTLY ONE question')
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

  const retryReturning = async (questions: unknown[]) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 're-taught', actions: [] }))
      .mockResolvedValueOnce(JSON.stringify({ questions }))
    const result = await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' },
      context: {
        board: {
          cards: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
          checkedSteps: [1],
          cardsSinceCheck: { 1: 2 },
          askedByStep: { 1: ['Which model fits like a lock and key?'] },
        },
      },
    })
    const cp = result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { questions: { id: string; format: string }[] }
      | undefined
    return cp?.questions ?? []
  }

  it('asks the retry as one question they have to answer, not spot', async () => {
    // A reworded multiple choice is what the learner met three times running.
    const asked = await retryReturning([
      { id: 'q1', format: 'mcq', prompt: 'Which model has a rigid shape?', options: ['a', 'b'], answer: 0 },
      { id: 'q2', format: 'short', prompt: 'Explain why the fit matters.', rubric: 'specificity' },
    ])
    expect(asked).toHaveLength(1)
    expect(asked[0].format).toBe('short')
  })

  it('still asks something when the retry comes back with no short question', async () => {
    // One multiple choice beats a step with no way to close it.
    const asked = await retryReturning([
      { id: 'q1', format: 'mcq', prompt: 'Which model has a rigid shape?', options: ['a', 'b'], answer: 0 },
      { id: 'q2', format: 'mcq', prompt: 'And which one flexes?', options: ['a', 'b'], answer: 1 },
    ])
    expect(asked).toHaveLength(1)
    expect(asked[0].format).toBe('mcq')
  })
})

describe('a step check is capped, not merely requested', () => {
  const askFor = async (kind: 'close' | 'testout', count: number) => {
    const questions = Array.from({ length: count }, (_, i) => ({
      id: `q${i}`, format: 'mcq', prompt: `Q${i}?`, options: ['a', 'b'], answer: 0,
    }))
    vi.mocked(callGemma).mockReset()
    if (kind === 'close') {
      vi.mocked(callGemma)
        .mockResolvedValueOnce(JSON.stringify({ say: 'taught', actions: [] }))
        .mockResolvedValueOnce(JSON.stringify({ questions }))
      const r = await applyAction({
        run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
        context: {
          board: {
            cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
            cardsSinceCheck: { 1: 3 },
          },
        },
      })
      const cp = r.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
        | { questions: unknown[] } | undefined
      return cp?.questions.length ?? 0
    }
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ questions }))
    const r = await applyAction({
      run: openRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' }, context: {},
    })
    return ((r.actions[0] as { questions: unknown[] })?.questions ?? []).length
  }

  it('closes a step with one question, never a test', async () => {
    // Three cards taught, then a three-question test, is what the learner met.
    // Asked for two, the model wrote the same question twice in two formats.
    expect(await askFor('close', 4)).toBe(1)
  })

  it('leaves a shorter check alone', async () => {
    expect(await askFor('close', 1)).toBe(1)
  })

  it('allows a test-out to be longer, since it skips the whole step', async () => {
    expect(await askFor('testout', 5)).toBe(3)
  })
})

/**
 * A practice card is a text box the student writes in.
 *
 * The model put "Which of the following best describes the role of an enzyme?
 * A) ... B) ... C) ..." in one, so the whole task was typing a letter —
 * recognition dressed up as practice, and awkward to mark. The prompt now
 * forbids it and this makes the forbidding real.
 */
describe('multiple choice does not survive on a practice card', () => {
  const teach = async (card: Record<string, unknown>) => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'have a go', actions: [{ type: 'createCard', id: 'p1', step: 1, ...card }] }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: null, action: { type: 'next_beat' }, context: {},
    })
    return result.actions as Record<string, unknown>[]
  }

  const ENZYME =
    'Which of the following best describes the role of an enzyme in a biological reaction? ' +
    'A) It provides energy to start the reaction. B) It is consumed during the reaction. ' +
    'C) It lowers the activation energy. D) It changes the equilibrium of the reaction.'

  it('takes the options off and leaves a question worth answering', async () => {
    const [out] = await teach({ card: 'practice', title: 'Enzyme role', body: ENZYME, answer: 'C' })
    expect(out.body).toBe('Which best describes the role of an enzyme in a biological reaction?')
    // "C" is not something marking can compare an answer against.
    expect(out.answer).toBe('It lowers the activation energy')
  })

  it('recovers the answer whichever way the letter was written', async () => {
    const [out] = await teach({ card: 'practice', title: 'Enzyme role', body: ENZYME, answer: 'b)' })
    expect(out.answer).toBe('It is consumed during the reaction')
  })

  it('drops a card whose stem was only there to introduce the options', async () => {
    const out = await teach({
      card: 'practice', title: 'Pick one', answer: 'A',
      body: 'Choose: A) sodium B) potassium C) calcium D) iron',
    })
    // Better no practice card — a state the lesson already handles — than a
    // card asking a question that is no longer there.
    expect(out.filter((a) => a.type === 'createCard')).toHaveLength(0)
  })

  it('leaves a real problem alone, brackets and all', async () => {
    const body = 'A car travels 120 km in 1.5 h. Work out its average speed in km/h.'
    const [out] = await teach({ card: 'practice', title: 'Speed', body, answer: '80 km/h' })
    expect(out.body).toBe(body)
    expect(out.answer).toBe('80 km/h')
  })

  it('does not mistake a lettered list in a concept card for a practice question', async () => {
    const body = 'The blood groups are A) type A, B) type B, C) type AB and D) type O.'
    const [out] = await teach({ card: 'concept', title: 'Blood groups', body })
    expect(out.body).toBe(body)
  })
})

/**
 * A short answer is marked by a separate route, which is handed the rubric and
 * nothing else from here. A learner who answered the question properly in their
 * own words was marked wrong for not using the rubric's phrasing.
 */
describe('a short question tells the marker the learner may use their own words', () => {
  const askWith = async (questions: unknown[]) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ questions }))
    const result = await applyAction({
      run: openRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'test_out', stepId: 'a', checkpointId: 'to-a' }, context: {},
    })
    return ((result.actions[0] as { questions: { rubric?: string; format: string }[] })?.questions ?? [])
  }

  it('adds it to a rubric that reads like a checklist', async () => {
    const [q] = await askWith([
      { id: 'q1', format: 'short', prompt: 'Why isolate first?', rubric: 'Must mention preparing for completing the square.' },
    ])
    expect(q.rubric).toContain('in whatever words the student used')
  })

  it('does not say it twice', async () => {
    const [q] = await askWith([
      { id: 'q1', format: 'short', prompt: 'Why isolate first?', rubric: 'Any answer in their own words showing the barrier drops.' },
    ])
    expect(q.rubric).toBe('Any answer in their own words showing the barrier drops.')
  })

  it('leaves multiple choice alone — there is nothing to paraphrase', async () => {
    const [q] = await askWith([
      { id: 'q1', format: 'mcq', prompt: 'Which one?', options: ['a', 'b'], answer: 0 },
    ])
    expect(q).not.toHaveProperty('rubric')
  })
})

/**
 * The tutor re-used a checkpoint id the learner had just failed. The reducer
 * drops a checkpoint whose id is already on the board, so no new questions
 * appeared — while the run opened a check against that id and waited for an
 * answer to questions that were already answered and gone. The lesson stopped
 * dead on step three: no banner, no questions, Continue producing nothing.
 */
describe('every check gets an id of its own', () => {
  const checkpointFrom = async (id: string) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'have a go',
        actions: [
          { type: 'checkpoint', id, step: 1, gate: 'hard', questions: [
            { id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 },
          ] },
        ],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: TAUGHT,
    })
    const cp = result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { id: string } | undefined
    return { id: cp?.id, run: result.run }
  }

  it('does not use the id the model chose', async () => {
    const { id } = await checkpointFrom('cp-3-a7')
    expect(id).not.toBe('cp-3-a7')
    expect(id).toMatch(/^cp-a-/)
  })

  it('opens the run against the id it actually put on the board', async () => {
    const { id, run } = await checkpointFrom('cp-3-a7')
    expect(run.openCheck?.checkpointId).toBe(id)
  })

  it('gives two turns emitting the same id two different checks', async () => {
    const first = await checkpointFrom('cp-3-a7')
    const second = await checkpointFrom('cp-3-a7')
    expect(first.id).not.toBe(second.id)
  })
})

/**
 * When a check may appear is the board's call, not the model's.
 *
 * At "step by step" pace the model returned three cards and a quiz on the very
 * first turn of a step — a whole step at once where the learner had asked for
 * one card at a time. And after a miss, one re-taught card brought the retry
 * straight back, so a learner's own question could trigger it.
 */
describe('an emitted checkpoint waits until the step has been taught', () => {
  const turn = async (board: Record<string, unknown>, cards = 1) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'here',
        actions: [
          ...Array.from({ length: cards }, (_, i) => ({
            type: 'createCard', id: `n${i}`, card: 'concept', title: `New ${i}`, body: 'x', step: 1,
          })),
          { type: 'checkpoint', id: 'cp-x', step: 1, gate: 'hard', questions: [
            { id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 },
          ] },
        ],
      }),
    )
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' }, context: { board },
    })
    return {
      hasCheck: result.actions.some((a) => (a as { type?: string }).type === 'checkpoint'),
      opened: result.run.openCheck !== undefined,
      cards: result.actions.filter((a) => (a as { type?: string }).type === 'createCard').length,
    }
  }

  it('is dropped on the first card of a fresh step', async () => {
    const out = await turn({ cards: [], cardsSinceCheck: {} }, 1)
    expect(out.hasCheck).toBe(false)
    expect(out.opened).toBe(false)
    // The teaching survives — only the gate is refused.
    expect(out.cards).toBe(1)
  })

  it('opens once the step has had its cards', async () => {
    const out = await turn({
      cards: [1, 2].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
      cardsSinceCheck: { 1: 2 },
    }, 1)
    expect(out.hasCheck).toBe(true)
    expect(out.opened).toBe(true)
  })

  it('counts the cards this same turn made', async () => {
    // Three cards and a checkpoint in one turn is the "run ahead" shape.
    const out = await turn({ cards: [], cardsSinceCheck: {} }, 3)
    expect(out.hasCheck).toBe(true)
  })

  it('lets a retry come back after one re-taught card', async () => {
    const out = await turn({
      cards: [{ id: 'c1', title: 'C1', step: 1, kind: 'concept' }],
      cardsSinceCheck: { 1: 0 },
      checkedSteps: [1],
    }, 1)
    expect(out.hasCheck).toBe(true)
  })

  it('does not let a question the learner asked bring the retry back', async () => {
    // The card that answered them is an aside; the step still owes a re-teach.
    const out = await turn({
      cards: [{ id: 'a1', title: 'Aside', step: 1, kind: 'concept', aside: true }],
      cardsSinceCheck: { 1: 0 },
      checkedSteps: [1],
    }, 0)
    expect(out.hasCheck).toBe(false)
  })
})

describe('"step by step" never closes a step on its first turn', () => {
  const fourCardsAndAQuiz = () =>
    JSON.stringify({
      say: 'here',
      actions: [
        ...[0, 1, 2, 3].map((i) => ({
          type: 'createCard', id: `n${i}`, card: 'concept', title: `New ${i}`, body: 'x', step: 1,
        })),
        { type: 'checkpoint', id: 'cp-x', step: 1, gate: 'hard', questions: [
          { id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 },
        ] },
      ],
    })

  /** The very first turn of a lesson: accepting the plan teaches step one. */
  const startAt = async (pace: 'step' | 'run') => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(fourCardsAndAQuiz())
    const planned = proposePlan(emptyRun(GAP), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!planned.ok) throw new Error(planned.reason)
    const result = await applyAction({
      run: planned.run, policy: GAP, userId: 'u1',
      action: { type: 'accept_plan', pace }, context: { board: { cards: [], cardsSinceCheck: {} } },
    })
    return result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')
  }

  it('refuses a check on the opening turn even when four cards arrive with it', async () => {
    // Four cards and a quiz is the other pace wearing this one's label. The
    // panel promises "one card at a time. I stop after each so you can ask".
    expect(await startAt('step')).toBe(false)
  })

  it('allows one on the turn after', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(fourCardsAndAQuiz())
    const result = await applyAction({
      run: { ...openRun(), pace: 'step' }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' }, context: { board: { cards: [], cardsSinceCheck: {} } },
    })
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(true)
  })

  it('leaves "run ahead" alone — a whole step in one turn is what it is for', async () => {
    expect(await startAt('run')).toBe(true)
  })
})

/**
 * The learner read "Here's a practice question to help you solidify your
 * understanding" beside a board with no question on it, several times running.
 * The model had addressed the card by its kind — `{ "type": "practice" }` —
 * instead of `{ "type": "createCard", "card": "practice" }`, with everything
 * else correct. Nothing recognised it, so the reducer dropped it in silence.
 */
describe('a card addressed by its kind instead of its type', () => {
  const teachReturningRaw = async (actions: unknown[]) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'have a go', actions }))
    return applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
      context: { board: { cards: [], cardsSinceCheck: {} } },
    })
  }

  it('is repaired rather than dropped', async () => {
    // Straight off a real board, one field away from working.
    const result = await teachReturningRaw([
      {
        type: 'practice', id: 's4-practice', step: 4,
        title: 'Gyroscopic Effect Practice',
        body: 'If you tilt the axle of a spinning wheel to the left, which way does it turn?',
        answer: 'forward',
        rubric: 'Identifies that it turns in the direction of the applied force.',
      },
    ])
    const [card] = result.actions as Record<string, unknown>[]
    expect(card.type).toBe('createCard')
    expect(card.card).toBe('practice')
    expect(card.title).toBe('Gyroscopic Effect Practice')
    expect(card.answer).toBe('forward')
  })

  it('repairs every card kind the same way', async () => {
    const result = await teachReturningRaw([
      { type: 'concept', id: 'c1', step: 1, title: 'Rates', body: 'x' },
      { type: 'callout', id: 'c2', step: 1, title: 'Watch out', body: 'y', variant: 'warning' },
    ])
    expect((result.actions as Record<string, unknown>[]).map((a) => [a.type, a.card])).toEqual([
      ['createCard', 'concept'],
      ['createCard', 'callout'],
    ])
  })

  it('leaves a properly formed action alone', async () => {
    const result = await teachReturningRaw([
      { type: 'createCard', id: 'c1', card: 'concept', step: 1, title: 'Rates', body: 'x' },
      { type: 'connect', from: 'c1', to: 'c2' },
    ])
    const [card, edge] = result.actions as Record<string, unknown>[]
    expect(card.card).toBe('concept')
    expect(edge.type).toBe('connect')
  })

  it('says so rather than narrating a card it could not build', async () => {
    // A shape nothing can repair. Announcing it anyway is the failure this
    // whole guard exists to stop.
    const result = await teachReturningRaw([{ type: 'sculpture', id: 'x1', step: 1 }])
    expect(result.refusal).toBeTruthy()
    expect(result.actions).toEqual([])
    expect(result.say).toBe('')
  })

  it('leaves a turn that only spoke alone', async () => {
    // Answering without building anything is normal and must not be refused.
    const result = await teachReturningRaw([])
    expect(result.refusal).toBeUndefined()
    expect(result.say).toBe('have a go')
  })
})

/**
 * Homework is not a topic. The step is a question the student was set and has
 * to hand in, so what closes it is answering that — not a quiz about the
 * subject in general, which would be a third party's question in the middle of
 * their own.
 */
describe('a homework step is checked with the question the student was set', () => {
  const homeworkRun = (): LessonRun => {
    const planned = proposePlan(emptyRun(policyFor('homework')), [
      {
        id: 'q1',
        title: 'An engineer must choose between two pumps',
        goal: 'An engineer must choose between two pumps. The interest rate is 7%. Find the best pump.',
        status: 'pending',
        cardIds: [],
        homework: {
          label: '1',
          answer: 'Pump B',
          rubric: 'Compares the equivalent annual cost of both and picks the lower.',
          attempt: 'EAC_A = 200,000(A/P, 7%, 12) + 30,000 = $54,621. B is better',
        },
      },
    ])
    if (!planned.ok) throw new Error(planned.reason)
    const started = acceptPlan(planned.run)
    if (!started.ok) throw new Error(started.reason)
    return started.run
  }

  const taught = {
    board: {
      cards: [1, 2, 3].map((i) => ({ id: `c${i}`, title: `C${i}`, step: 1, kind: 'concept' })),
      cardsSinceCheck: { 1: 3 },
    },
  }

  it('asks their own question back, and spends no call writing one', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'nearly there', actions: [] }))
    const result = await applyAction({
      run: { ...homeworkRun(), beats: 1 }, policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' }, context: taught,
    })

    const cp = result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { questions: { format: string; prompt: string; rubric?: string }[] }
      | undefined
    expect(cp?.questions).toHaveLength(1)
    expect(cp!.questions[0].format).toBe('short')
    expect(cp!.questions[0].prompt).toContain('choose between two pumps')
    expect(cp!.questions[0].rubric).toContain('equivalent annual cost')
    // One call: the teaching turn. Nothing wrote a quiz.
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('falls back to marking on the working when the sheet gave no rubric', async () => {
    const run = homeworkRun()
    run.steps[0].homework!.rubric = null
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'go on', actions: [] }))
    const result = await applyAction({
      run: { ...run, beats: 1 }, policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' }, context: taught,
    })
    const cp = result.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as
      | { questions: { rubric?: string }[] } | undefined
    expect(cp!.questions[0].rubric).toContain('whatever words')
  })

  it('drops a quiz the model made up for a homework step', async () => {
    // It would close the step without them ever answering their own question.
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'here',
        actions: [
          { type: 'createCard', id: 'n1', card: 'concept', title: 'Annual cost', body: 'x', step: 1 },
          { type: 'checkpoint', id: 'cp-mine', step: 1, gate: 'hard', questions: [
            { id: 'q1', format: 'mcq', prompt: 'What does EAC stand for?', options: ['a', 'b'], answer: 0 },
          ] },
        ],
      }),
    )
    const result = await applyAction({
      run: homeworkRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' }, context: { board: { cards: [], cardsSinceCheck: {} } },
    })
    const cps = result.actions.filter((a) => (a as { type?: string }).type === 'checkpoint')
    expect(cps).toHaveLength(0)
    // The teaching it did still lands.
    expect(result.actions.some((a) => (a as { type?: string }).type === 'createCard')).toBe(true)
  })

  it('tells the teaching turn it is homework, and not to write the answer', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'ok', actions: [] }))
    await applyAction({
      run: homeworkRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' },
      context: { board: { cards: [], cardsSinceCheck: {} }, given: ['Pump A: 200,000 initial cost'] },
    })
    const prompt = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(prompt).toContain('THIS IS HOMEWORK, NOT A TOPIC')
    expect(prompt).toContain('NEVER WRITE THE ANSWER TO THEIR QUESTION')
    // Their own working reaches it, so it can start where they actually are.
    expect(prompt).toContain('54,621')
    expect(prompt).toContain('THEY HAVE ALREADY WRITTEN THIS')
    // And the data off the sheet, since the photo is never sent again.
    expect(prompt).toContain('Pump A: 200,000 initial cost')
  })

  it('says the page is blank when they had not started it', async () => {
    const run = homeworkRun()
    run.steps[0].homework!.attempt = null
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'ok', actions: [] }))
    await applyAction({
      run, policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' }, context: { board: { cards: [], cardsSinceCheck: {} } },
    })
    const prompt = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(prompt).toContain('they have not started it')
    expect(prompt).not.toContain('THEY HAVE ALREADY WRITTEN THIS')
  })

  it('leaves an ordinary lesson step checked the ordinary way', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma)
      .mockResolvedValueOnce(JSON.stringify({ say: 'taught', actions: [] }))
      .mockResolvedValueOnce(JSON.stringify({
        questions: [{ id: 'q1', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 0 }],
      }))
    const result = await applyAction({
      run: { ...openRun(), beats: 1 }, policy: GAP, userId: 'u1',
      action: { type: 'next_beat' }, context: taught,
    })
    expect(result.actions.some((a) => (a as { type?: string }).type === 'checkpoint')).toBe(true)
    // Two calls: the teaching turn, then the check being written.
    expect(callGemma).toHaveBeenCalledTimes(2)
  })
})

/**
 * Phase 3 of homework help: the ways out.
 */
describe('a photo of their own work is actually read', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

  it('goes to the model, and the turn is told to answer what is on it', async () => {
    // The attach button has always been there, and the photo has always shown
    // in the transcript. Nothing read it, so the reply came back as though the
    // page were not in front of it.
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'line three is where it goes', actions: [] }))
    await applyAction({
      run: openRun(), policy: GAP, userId: 'u1',
      action: { type: 'ask', question: 'is this right?', image: PNG },
      context: {},
    })
    const [prompt, opts] = vi.mocked(callGemma).mock.calls[0] as [string, Record<string, unknown>]
    expect(prompt).toContain('THEY HAVE ATTACHED A PHOTO OF THEIR OWN WORK')
    expect(opts.image).toEqual({ mimeType: 'image/png', base64: PNG.split(',')[1] })
  })

  it('says nothing about a photo when there is not one', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'sure', actions: [] }))
    await applyAction({
      run: openRun(), policy: GAP, userId: 'u1',
      action: { type: 'ask', question: 'why?' }, context: {},
    })
    const [prompt, opts] = vi.mocked(callGemma).mock.calls[0] as [string, Record<string, unknown>]
    expect(prompt).not.toContain('ATTACHED A PHOTO')
    expect(opts.image).toBeUndefined()
  })

  it('ignores something that is not an image without failing the turn', async () => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'sure', actions: [] }))
    const result = await applyAction({
      run: openRun(), policy: GAP, userId: 'u1',
      action: { type: 'ask', question: 'why?', image: 'https://example.test/x.png' }, context: {},
    })
    expect(result.say).toBe('sure')
    expect((vi.mocked(callGemma).mock.calls[0][1] as Record<string, unknown>).image).toBeUndefined()
  })
})

describe('missing the same homework question twice', () => {
  const stuckRun = (): LessonRun => {
    const planned = proposePlan(emptyRun(policyFor('homework')), [
      {
        id: 'q1',
        title: 'Find the best pump',
        goal: 'An engineer must choose between two pumps. Find the best pump.',
        status: 'pending',
        cardIds: [],
        homework: { label: '1', answer: 'Pump B', rubric: 'Compares annual cost.', attempt: null },
      },
    ])
    if (!planned.ok) throw new Error(planned.reason)
    const started = acceptPlan(planned.run)
    if (!started.ok) throw new Error(started.reason)
    return started.run
  }

  const teachWith = async (asked: string[]) => {
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'ok', actions: [] }))
    await applyAction({
      run: stuckRun(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'next_beat' },
      context: { board: { cards: [], cardsSinceCheck: {}, askedByStep: { 1: asked } } },
    })
    return String(vi.mocked(callGemma).mock.calls[0][0])
  }

  it('switches to working a parallel problem in full', async () => {
    // Two misses is not a third hint away from landing. Seeing it done on a
    // different problem is the only way to show them without handing in their
    // homework for them.
    const prompt = await teachWith(['Find the best pump.', 'Find the best pump.'])
    expect(prompt).toContain('MISSED THIS QUESTION TWICE')
    expect(prompt).toContain('PARALLEL problem')
    expect(prompt).toContain('DIFFERENT numbers')
  })

  it('does not offer it on a first or second attempt', async () => {
    expect(await teachWith([])).not.toContain('MISSED THIS QUESTION TWICE')
    expect(await teachWith(['Find the best pump.'])).not.toContain('MISSED THIS QUESTION TWICE')
  })

  it('never does it on an ordinary lesson step', async () => {
    // There is no "their question" to hand back.
    vi.mocked(callGemma).mockReset()
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say: 'ok', actions: [] }))
    await applyAction({
      run: openRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
      context: { board: { cards: [], cardsSinceCheck: {}, askedByStep: { 1: ['a?', 'b?'] } } },
    })
    expect(String(vi.mocked(callGemma).mock.calls[0][0])).not.toContain('MISSED THIS QUESTION TWICE')
  })
})

/**
 * A second page is added to a plan that is already running. It must not teach:
 * the learner is part-way through question two, and a teaching turn here would
 * put another card on that rather than acknowledge the page.
 */
describe('adding another page of the same assignment', () => {
  const running = (): LessonRun => {
    const planned = proposePlan(emptyRun(policyFor('homework')), [
      { id: 'q1', title: 'Find the best pump', goal: 'Find the best pump.', status: 'pending', cardIds: [],
        homework: { label: '1', answer: null, rubric: null, attempt: null } },
      { id: 'q2', title: 'Repeat at 4%', goal: 'Repeat at 4%.', status: 'pending', cardIds: [],
        homework: { label: '2', answer: null, rubric: null, attempt: null } },
    ])
    if (!planned.ok) throw new Error(planned.reason)
    const started = acceptPlan(planned.run)
    if (!started.ok) throw new Error(started.reason)
    return started.run
  }

  const sheet = {
    questions: [
      { label: '1', text: 'Find the best pump.' },
      { label: '2', text: 'Repeat at 4%.' },
      { label: '1', text: 'Sketch the cash flow diagram for pump B.' },
    ],
  }

  it('appends the question and leaves the step they are on alone', async () => {
    vi.mocked(callGemma).mockReset()
    const run = running()
    const result = await applyAction({
      run, policy: policyFor('homework'), userId: 'u1',
      action: { type: 'add_homework_page', sheet, questionIds: ['q3'] },
      context: {},
    })
    expect(result.run.steps.map((s) => s.id)).toEqual(['q1', 'q2', 'q3'])
    expect(result.run.currentStep).toBe(run.currentStep)
    expect(result.run.steps[2].homework?.label).toBe('1')
    expect(result.ack).toContain('Added that question')
  })

  it('spends no model call — it is a plan edit, not a lesson', async () => {
    vi.mocked(callGemma).mockReset()
    await applyAction({
      run: running(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'add_homework_page', sheet, questionIds: ['q3'] }, context: {},
    })
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('numbers the new step from where the plan already ends', async () => {
    // Its printed label is "1" and it lands at position 3, so the label has to
    // survive or the rail loses which question it is.
    const result = await applyAction({
      run: running(), policy: policyFor('homework'), userId: 'u1',
      action: { type: 'add_homework_page', sheet, questionIds: ['q3'] }, context: {},
    })
    expect(result.run.steps[2].title).toContain('1.')
  })

  it('refuses a page nobody picked anything from, without touching the plan', async () => {
    const run = running()
    const result = await applyAction({
      run, policy: policyFor('homework'), userId: 'u1',
      action: { type: 'add_homework_page', sheet, questionIds: [] }, context: {},
    })
    expect(result.refusal).toContain('Pick at least one')
    expect(result.run.steps).toHaveLength(2)
  })
})
