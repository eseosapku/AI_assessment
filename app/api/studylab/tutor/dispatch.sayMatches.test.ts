// app/api/studylab/tutor/dispatch.sayMatches.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { callGemma } from '@/lib/bedrock'
import { applyAction } from './dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan } from '@/lib/studylab/lessonRun'

/**
 * Found live: a river lesson's opening line read "Drag the river features to
 * see how much energy each one has" over a slope slider. The turn built two
 * materials, one was refused, and Inky's line still described the refused one.
 */
const GAP = policyFor('gap')
const STEP = { id: 's1', title: 'Metals and non-metals', goal: 'Sort elements into metals and non-metals', status: 'pending' as const, cardIds: [] }
const sortSpec = {
  pattern: 'sort', prompt: 'Sort the elements into metals and non-metals.',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' }, { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}
const intent = { goal: 'Tell metals from non-metals.', isolates: 'category', apparatus: 'sorting-frame', why: 'Sorting is the decision.' }
const sort = { type: 'createActivity', id: 'm-sort', spec: sortSpec, intent, step: 1 }
const brokenSlider = { type: 'createActivity', id: 'm-slider', spec: { pattern: 'vary', prompt: 'Drag the features', payload: {}, success: {} }, intent, step: 1 }

function planning() {
  const p = proposePlan(emptyRun(GAP), [STEP])
  if (!p.ok) throw new Error(p.reason)
  return p.run
}
const open = (say: string, actions: unknown[]) => {
  vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ say, actions }))
  return applyAction({ run: planning(), policy: GAP, userId: 'u1', action: { type: 'accept_plan' }, context: { title: 'Elements', subject: 'Chemistry' } })
}

beforeEach(() => vi.mocked(callGemma).mockReset())

describe("Inky's opening line on a station", () => {
  it('says what the card on the board asks when a material it described was refused', async () => {
    const out = await open('Drag the river features to see how much energy each one has.', [brokenSlider, sort])
    expect(out.actions.map((a) => (a as { id?: string }).id)).toEqual(['m-sort'])
    expect(out.say).toBe('Sort the elements into metals and non-metals.')
  })

  it("keeps Inky's own line when nothing was refused", async () => {
    const out = await open('Watch which ones bend.', [sort])
    expect(out.say).toBe('Watch which ones bend.')
  })
})
