// app/api/studylab/tutor/dispatch.intent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
}))

import { callGemma } from '@/lib/bedrock'
import { refuseUnjustifiedActivities, applyAction } from './dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'

// Two items split across two bins: dimensionsOf refuses a sorting frame where
// every item lands in the same place, since there is no decision to make.
const spec = {
  pattern: 'sort',
  prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [
      { id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' },
      { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' },
    ],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}

const intent = {
  goal: 'Tell metals from non-metals.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

describe('refuseUnjustifiedActivities', () => {
  it('lets a justified material through', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept).toHaveLength(1)
    expect(refused).toEqual([])
  })

  it('refuses a material with no intent at all', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', spec }])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/intent/i)
  })

  it('refuses a reason the material does not support', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'quantity' }, spec },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('quantity')
  })

  it('refuses a structurally invalid spec before it reaches the intent check', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent, spec: { pattern: 'sort' } },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/spec/i)
  })

  it('refuses words where the catalogue holds pictures', () => {
    // Two items with different labels: dimensionsOf refuses a three-period
    // deck that names only one thing, since a single label is not identity.
    const wordy = {
      ...spec,
      pattern: 'threePeriod',
      payload: {
        items: [{ id: 'i1', label: 'Neuron' }, { id: 'i2', label: 'Photosynthesis' }],
        phases: ['present'],
      },
      success: { kind: 'exactSet', itemIds: ['i1', 'i2'] },
    }
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'identity' }, spec: wordy },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('Neuron')
  })

  it('leaves every other action untouched', () => {
    const others = [{ type: 'createCard', card: 'concept', id: 'c1' }, { type: 'connect', source: 'a', target: 'b' }]
    expect(refuseUnjustifiedActivities(others).kept).toEqual(others)
  })

  it('strips the intent before the action reaches the board', () => {
    // The intent is why the material exists, not part of it. Leaving it on the
    // action would put it in the node's data and eventually on screen.
    const { kept } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept[0]).not.toHaveProperty('intent')
  })
})

/** A montessori-mode run mid-lesson, teaching its single step. */
function montessoriRun(): LessonRun {
  const policy = policyFor('scratch')
  const planned = proposePlan(emptyRun(policy), [
    { id: 'a', title: 'Metals', goal: 'Tell metals from non-metals.', status: 'pending', cardIds: [] },
  ])
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan(planned.run)
  if (!started.ok) throw new Error(started.reason)
  return { ...started.run, mode: 'montessori' }
}

// A follow-up question is a SECOND route to the board (`applyAsk`), separate
// from the teaching turn `refuseUnjustifiedActivities` above is wired into.
// `buildTeachPrompt`'s montessori block used to be gated only on `run.mode`,
// with nothing distinguishing a teaching beat from an aside — so a student
// asking a question mid-lesson got told, in NON-NEGOTIABLE terms, to build a
// material, and anything the model returned skipped the refusal entirely.
describe('applyAsk on a montessori run', () => {
  beforeEach(() => vi.mocked(callGemma).mockReset())

  it('does not ask for a material on a follow-up question', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Iron is a metal because it conducts and is malleable.', actions: [] }),
    )
    await applyAction({
      run: montessoriRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: 'why is iron with the metals?' }, context: {},
    })
    const prompt = vi.mocked(callGemma).mock.calls[0][0] as string
    expect(prompt).not.toContain('BUILDING A MATERIAL')
  })

  it('drops a createActivity the model emits anyway, on an aside turn', async () => {
    // The prompt guard above is not a guarantee, so this is the backstop that
    // actually matters: an aside never reaches `refuseUnjustifiedActivities`
    // (that runs only on the teaching path), so a material that slipped past
    // the prompt would otherwise land on the board with no intent check, no
    // art check, and its `intent` field still attached.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Iron is a metal.',
        actions: [{ type: 'createActivity', id: 'a1', intent, spec }],
      }),
    )
    const result = await applyAction({
      run: montessoriRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: 'why is iron with the metals?' }, context: {},
    })
    expect(result.actions).toEqual([])
  })

  it('drops a build_material the model emits anyway, on an aside turn', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({
        say: 'Iron is a metal.',
        actions: [{
          type: 'build_material',
          id: 'm1',
          intent,
          spec: {
            prompt: 'Sort.',
            pieces: [{ id: 'p1', label: 'Iron', traits: { metal: 1 } }],
            groups: [{ id: 'g1', label: 'Metals', ordered: false }],
            slots: [{ id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 1 }],
            rules: [],
            goal: { kind: 'exactSet', itemIds: ['p1'] },
          },
        }],
      }),
    )
    const result = await applyAction({
      run: montessoriRun(), policy: policyFor('scratch'), userId: 'u1',
      action: { type: 'ask', question: 'why is iron with the metals?' }, context: {},
    })
    expect(result.actions).toEqual([])
  })
})
