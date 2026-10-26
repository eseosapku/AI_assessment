// lib/studylab/stationBundle.test.ts
import { describe, it, expect } from 'vitest'
import { verifyBundleCode, type StationBundle } from './stationBundle'

/**
 * An authored station is served with no model in the loop, so whatever is
 * wrong with it reaches the learner as it is. These are the checks code can
 * make before a judge is asked anything.
 */
const sortSpec = {
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
const sortIntent = { goal: 'Tell metals from non-metals.', isolates: 'category', apparatus: 'sorting-frame', why: 'Sorting is the decision.' }
const card = (id: string, title: string) => ({ type: 'createCard', id, card: 'concept', title, body: `${title}: a real sentence with an example.`, step: 1 })

function good(): StationBundle {
  return {
    version: 'v1',
    stepId: 's1',
    explore: { opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'm1', spec: sortSpec, step: 1 } as never, intent: sortIntent as never, hints: ['Shiny ones?', 'Which conduct?'] },
    name: {
      solved: { say: 'You split them by how they behave.', actions: [card('n1', 'Metals and non-metals'), { type: 'point', nodeId: 'm1', part: 'piece-i1' }] as never },
      helped: { say: 'Iron is the one that tells you.', actions: [card('n2', 'What makes a metal')] as never },
      untried: { say: 'Here is the idea the sort shows.', actions: [card('n3', 'Two kinds of element')] as never },
    },
    practice: { say: 'Same idea, new elements.', action: { type: 'createCard', id: 'p1', card: 'practice', title: 'Copper or carbon?', body: 'Which is a metal?', answer: 'Copper', rubric: 'Names copper', steps: ['Copper conducts'], step: 1 } as never },
    check: {
      say: 'Quick check.',
      questions: [
        { id: 'q1', format: 'mcq', prompt: 'Which is a metal?', options: ['Sulfur', 'Iron', 'Oxygen'], answer: 1, optionFeedback: ['Sulfur is brittle and dull.', 'Yes -- iron conducts.', 'Oxygen is a gas.'] },
        { id: 'q2', format: 'short', prompt: 'Why does copper count as a metal?', rubric: 'Mentions conducting or being shiny/malleable' },
      ] as never,
    },
  }
}
const fails = (b: unknown) => {
  const r = verifyBundleCode(b)
  if (r.ok) throw new Error('expected a refusal')
  return r
}

describe('verifyBundleCode', () => {
  it('passes a well-formed station', () => {
    expect(verifyBundleCode(good()).ok).toBe(true)
  })

  it('refuses a check whose key is out of range, or a wrong option with nothing to say to whoever picks it', () => {
    const b = good()
    ;(b.check.questions[0] as { answer: number }).answer = 5
    expect(fails(b).pass).toBe('practice_check')
    const c = good()
    ;(c.check.questions[0] as { optionFeedback: string[] }).optionFeedback = ['Sulfur is brittle.', 'Yes.', '']
    expect(fails(c).pass).toBe('practice_check')
  })

  it('refuses a short question with no rubric to mark it by', () => {
    const b = good()
    delete (b.check.questions[1] as { rubric?: string }).rubric
    expect(fails(b).pass).toBe('practice_check')
  })

  it('refuses an explore material the live path would refuse', () => {
    const b = good()
    b.explore.intent = { ...sortIntent, isolates: 'quantity' } as never
    expect(fails(b).pass).toBe('explore')
    const c = good()
    c.explore.action = { type: 'createActivity', id: 'm1', spec: { pattern: 'sort' }, step: 1 } as never
    expect(fails(c).pass).toBe('explore')
  })

  it('refuses a vary material that does not cite the relationship it models', () => {
    const b = good()
    b.explore.action = {
      type: 'createActivity', id: 'm1', step: 1,
      spec: {
        pattern: 'vary', prompt: 'Change the temperature',
        payload: {
          variable: { id: 'temperature', label: 'Temperature', min: 0, max: 10, step: 1 },
          model: { kind: 'bars', bars: [{ label: 'Rate', expr: 'temperature', max: 10 }] },
          readouts: [{ label: 'Temperature', expr: 'temperature' }],
          target: { expr: 'temperature', value: 5, tolerance: 0.5 },
        },
        success: { kind: 'numericWithin', target: 5, tolerance: 0.5 },
      },
    } as never
    b.explore.intent = { goal: 'See rate rise with temperature.', isolates: 'magnitude', apparatus: 'variable-model', why: 'One handle, one output.' } as never
    expect(fails(b).reasons.join(' ')).toMatch(/relationship/i)
  })

  it('refuses a name cut of more than two cards, or a point at something not in the station', () => {
    const b = good()
    b.name.helped.actions = [card('a', 'One'), card('b', 'Two'), card('c', 'Three')] as never
    expect(fails(b).pass).toBe('name')
    const c = good()
    c.name.solved.actions = [card('n1', 'Metals'), { type: 'point', nodeId: 'elsewhere' }] as never
    expect(fails(c).pass).toBe('name')
  })

  it('refuses a practice problem with no answer or worked steps', () => {
    const b = good()
    delete (b.practice.action as { answer?: string }).answer
    expect(fails(b).pass).toBe('practice_check')
  })

  it('tells a malformed material what to do instead: fit its schema, or open with a predict item', () => {
    const b = good()
    b.explore = { ...b.explore, action: { type: 'createActivity', id: 'm1', spec: { pattern: 'compose', prompt: 'Fill the table', payload: { parts: [], validJoins: [] }, success: { kind: 'exactSet', itemIds: [] } }, step: 1 } as never }
    const v = fails(b)
    expect(v.reasons.join(' ')).toMatch(/"compose".*schema/)
    expect(v.reasons.join(' ')).toMatch(/Predict:/)
  })

  it('accepts a predict item where no material fits', () => {
    const b = good()
    b.explore = { opening: 'Guess before you read.', action: { type: 'createCard', id: 'm1', card: 'practice', title: 'Predict: which city grew first?', body: 'Look at the map.', answer: 'The one on the river', rubric: 'Names the river city', steps: ['Water and trade'], step: 1 } as never, hints: [] }
    b.name.solved.actions = [card('n1', 'Rivers and cities')] as never
    expect(verifyBundleCode(b).ok).toBe(true)
  })
})
