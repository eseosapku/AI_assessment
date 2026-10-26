// app/api/studylab/tutor/dispatch.authored.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
const authorState = vi.hoisted(() => vi.fn())
vi.mock('@/lib/studylab/stationJobs', async (orig) => ({
  ...(await orig<typeof import('@/lib/studylab/stationJobs')>()),
  authorState,
}))

import { callGemma } from '@/lib/bedrock'
import { applyAction, type DispatchInput } from './dispatch'
import { stationVersion } from '@/lib/studylab/stationJobs'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun, type Stage } from '@/lib/studylab/lessonRun'
import { COMPREHENSION_CHIPS } from '@/lib/studylab/chips'

const GAP = policyFor('gap')
const STEP = { id: 's1', title: 'Metals and non-metals', goal: 'Sort elements into metals and non-metals', status: 'pending' as const, cardIds: [] }
const VERSION = stationVersion({ title: STEP.title, goal: STEP.goal, position: 0, subject: 'Chemistry' })

const sortSpec = {
  pattern: 'sort', prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' }, { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}
const intent = { goal: 'Tell metals from non-metals.', isolates: 'category', apparatus: 'sorting-frame', why: 'Sorting is the decision.' }
const card = (id: string, title: string) => ({ type: 'createCard', id, card: 'concept', title, body: 'A real sentence with an example.', step: 1 })
const bundle = (over: Record<string, unknown> = {}) => ({
  version: VERSION,
  stepId: 's1',
  explore: { opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 's1-explore', spec: sortSpec, step: 1 }, intent, hints: ['Shiny?'] },
  name: {
    solved: { say: 'You split them by behaviour.', actions: [card('s1-solved-1', 'Metals bend')] },
    helped: { say: 'Iron told you.', actions: [card('s1-helped-1', 'Iron gave it away')] },
    untried: { say: 'Here is the idea.', actions: [card('s1-untried-1', 'What makes a metal')] },
  },
  practice: { say: 'Same idea.', action: { type: 'createCard', id: 's1-practice', card: 'practice', title: 'Copper or carbon?', body: 'Which is a metal?', answer: 'Copper', rubric: 'Names copper', steps: ['Copper conducts'], step: 1 } },
  check: { say: 'Quick check.', questions: [{ id: 'q1', format: 'mcq', prompt: 'Which is a metal?', options: ['Sulfur', 'Iron'], answer: 1, optionFeedback: ['Sulfur is brittle.', 'Yes.'] }] },
  ...over,
})
const ready = (b: Record<string, unknown> = bundle()) =>
  authorState.mockResolvedValue({ status: 'ready', done: ['explore', 'name', 'practice_check', 'verify'], partial: {}, retries: 0, bundle: b })

function planning(): LessonRun {
  const p = proposePlan(emptyRun(GAP), [STEP])
  if (!p.ok) throw new Error(p.reason)
  return p.run
}
function station(stage: Stage, over: Partial<LessonRun> = {}): LessonRun {
  const s = acceptPlan(planning())
  if (!s.ok) throw new Error(s.reason)
  return { ...s.run, stage, stationOrigin: 'authored', ...over }
}
const turn = (run: LessonRun, action: DispatchInput['action'], board: Record<string, unknown> = {}) =>
  applyAction({ run, policy: GAP, userId: 'u1', spaceId: 'sp1', action, context: { title: 'Elements', subject: 'Chemistry', board } })
const live = { say: 'Live turn.', actions: [{ type: 'createCard', id: 'live-1', card: 'practice', title: 'Predict: which bends?', body: 'Say which.', answer: 'Iron', step: 1 }] }

beforeEach(() => {
  vi.mocked(callGemma).mockReset()
  vi.mocked(callGemma).mockResolvedValue(JSON.stringify(live))
  authorState.mockReset()
  authorState.mockResolvedValue({ status: 'none', done: [], partial: {}, retries: 0 })
})

describe('an authored station is served at once', () => {
  it('opens a ready station with its explore and no model call', async () => {
    ready()
    const out = await turn(planning(), { type: 'accept_plan' })
    expect(callGemma).not.toHaveBeenCalled()
    expect(authorState).toHaveBeenCalledWith('sp1', 's1', VERSION)
    expect(out.say).toBe('Watch which ones bend.')
    expect(out.actions).toHaveLength(1)
    expect(out.actions[0]).toMatchObject({ type: 'createActivity', id: 's1-explore' })
    // The intent is why the material exists; it never rides onto the board.
    expect(out.actions[0]).not.toHaveProperty('intent')
    expect(out.intents?.[0]).toMatchObject({ isolates: 'category' })
    expect(out.run.stationOrigin).toBe('authored')
    expect(out.run.stage).toBe('explore')
    expect(out.suggestions).toEqual([])
  })

  it.each([
    [{ outcome: 'solved', attempts: 1 }, 'You split them by behaviour.'],
    [{ outcome: 'solved', attempts: 3 }, 'Iron told you.'],
    [{ outcome: 'tried', attempts: 2 }, 'Here is the idea.'],
    [{ outcome: 'untried', attempts: 0 }, 'Here is the idea.'],
    [undefined, 'Here is the idea.'],
  ])('names it the way the explore went (%o)', async (explored, say) => {
    ready()
    const out = await turn(station('explore'), { type: 'next_beat' }, explored ? { exploreByStep: { 1: explored } } : {})
    expect(callGemma).not.toHaveBeenCalled()
    expect(out.say).toBe(say)
    expect(out.run.stage).toBe('name')
    expect(out.suggestions).toEqual([...COMPREHENSION_CHIPS])
  })

  it('serves its practice, then its check, opened hard with the questions kept for marking', async () => {
    ready()
    const practice = await turn(station('name'), { type: 'next_beat' })
    expect(practice.say).toBe('Same idea.')
    expect(practice.actions[0]).toMatchObject({ id: 's1-practice', card: 'practice' })
    expect(practice.suggestions).toEqual([])

    const check = await turn(practice.run, { type: 'next_beat' })
    expect(callGemma).not.toHaveBeenCalled()
    expect(check.say).toBe('Quick check.')
    expect(check.run.stage).toBe('check')
    expect(check.run.openCheck).toMatchObject({ stepId: 's1', kind: 'checkpoint', gate: 'hard' })
    expect(check.run.openCheck?.questions).toHaveLength(1)
    const cp = check.actions.find((a) => (a as { type?: string }).type === 'checkpoint') as { id: string; gate: string; questions: unknown[] }
    expect(cp).toMatchObject({ gate: 'hard', step: 1 })
    expect(cp.id).toBe(check.run.openCheck?.checkpointId)
    expect(cp.questions).toHaveLength(1)
  })
})

describe('a practice that is a material', () => {
  const sortTwin = { ...sortSpec, prompt: 'Sort these too', payload: { ...sortSpec.payload, items: [{ id: 'i3', label: 'Copper', binId: 'b1', imageUrl: 'copper' }, { id: 'i4', label: 'Carbon', binId: 'b2', imageUrl: 'carbon' }] }, success: { kind: 'binAssignment', assign: { i3: 'b1', i4: 'b2' } } }
  const withMaterialPractice = () => bundle({ practice: { say: 'Two more.', action: { type: 'createActivity', id: 's1-practice', spec: sortTwin, step: 1 }, intent } })

  it('is served at its beat, its intent back on for the gates and off again for the board', async () => {
    ready(withMaterialPractice())
    const out = await turn(station('name'), { type: 'next_beat' })
    expect(callGemma).not.toHaveBeenCalled()
    expect(out.say).toBe('Two more.')
    expect(out.actions[0]).toMatchObject({ type: 'createActivity', id: 's1-practice' })
    expect(out.actions[0]).not.toHaveProperty('intent')
  })

  it('does not send a run-pace station live', async () => {
    ready(withMaterialPractice())
    const out = await turn({ ...planning(), pace: 'run' }, { type: 'accept_plan' })
    expect(callGemma).not.toHaveBeenCalled()
    expect(out.run.stationOrigin).toBe('authored')
    expect(out.actions.map((a) => (a as { id?: string }).id)).toContain('s1-practice')
  })
})

describe('live beats take over whenever it cannot be', () => {
  it('teaches a station live when its bundle is not ready, and keeps it live', async () => {
    const out = await turn(planning(), { type: 'accept_plan' })
    expect(callGemma).toHaveBeenCalled()
    expect(out.run.stationOrigin).toBe('live')
  })

  it('never switches a station to its bundle once its explore was live', async () => {
    ready()
    const out = await turn(station('explore', { stationOrigin: 'live' }), { type: 'next_beat' })
    expect(callGemma).toHaveBeenCalled()
    expect(out.say).toBe('Live turn.')
  })

  it('never serves a bundle written for an older version of the step', async () => {
    ready(bundle({ version: 'old-version' }))
    const out = await turn(planning(), { type: 'accept_plan' })
    expect(callGemma).toHaveBeenCalled()
    expect(out.run.stationOrigin).toBe('live')
  })

  it('runs live, without a word about it, when the bundle fails its checks at serve time', async () => {
    ready(bundle({ check: { say: 'Quick check.', questions: [] } }))
    const out = await turn(planning(), { type: 'accept_plan' })
    expect(callGemma).toHaveBeenCalled()
    expect(out.run.stationOrigin).toBe('live')
    expect(out.refusal).toBeUndefined()
  })

  it('writes the near-twin after a missed check live', async () => {
    ready()
    await turn(station('practice', { stationMisses: 1 }), { type: 'next_beat' })
    expect(callGemma).toHaveBeenCalled()
  })

  it('writes the check after a missed practice live, as its near-twin', async () => {
    ready()
    await turn(station('practice'), { type: 'next_beat' }, { missedByStep: { 1: ['Which is a metal?'] } })
    expect(callGemma).toHaveBeenCalled()
  })

  it('serves the whole station at once at run pace, as a live run-pace turn builds it', async () => {
    // Topic lessons start at run pace by default: without this, most lessons
    // would pay for a station and never be served one.
    ready()
    const out = await turn({ ...planning(), pace: 'run' }, { type: 'accept_plan' })
    expect(callGemma).not.toHaveBeenCalled()
    expect(out.say).toBe('Watch which ones bend.')
    const ids = out.actions.map((a) => (a as { id?: string; type: string }).id ?? (a as { type: string }).type)
    // The explore, the name -- true whatever they did, so no outcome is claimed -- the practice, the check.
    expect(ids.slice(0, 2)).toEqual(['s1-explore', 's1-solved-1'])
    expect(ids).toContain('s1-practice')
    expect(ids).not.toContain('s1-untried-1')
    expect((out.actions.at(-1) as { type: string }).type).toBe('checkpoint')
    expect(out.run.openCheck).toMatchObject({ gate: 'hard' })
    expect(out.run.stationOrigin).toBe('authored')
  })

  it('keeps a run-pace station live once it is under way', async () => {
    ready()
    await turn(station('name', { pace: 'run' }), { type: 'next_beat' })
    expect(callGemma).toHaveBeenCalled()
  })

  it('teaches live when the bundle cannot be looked up', async () => {
    authorState.mockRejectedValue(new Error('connection reset'))
    const out = await turn(planning(), { type: 'accept_plan' })
    expect(callGemma).toHaveBeenCalled()
    expect(out.run.stationOrigin).toBe('live')
  })

  it('looks nothing up for a lesson with no id to look under', async () => {
    ready()
    await applyAction({ run: planning(), policy: GAP, userId: 'u1', action: { type: 'accept_plan' }, context: { title: 'Elements', subject: 'Chemistry' } })
    expect(authorState).not.toHaveBeenCalled()
  })
})

describe('the origin belongs to one station', () => {
  it('is forgotten when the lesson lands on another step', async () => {
    const two = proposePlan(emptyRun(GAP), [STEP, { ...STEP, id: 's2', title: 'Alloys', goal: 'Why alloys are harder' }])
    if (!two.ok) throw new Error(two.reason)
    const started = acceptPlan(two.run)
    if (!started.ok) throw new Error(started.reason)
    const run = { ...started.run, stationOrigin: 'authored' as const }
    const out = await turn(run, { type: 'jump', stepId: 's2' })
    expect(out.run.currentStep).toBe(1)
    expect(out.run.stationOrigin).not.toBe('authored')
  })
})
