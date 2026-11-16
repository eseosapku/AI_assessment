// lib/studylab/meaning/selfAnswer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { selfAnswerFaults } from './selfAnswer'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Nothing on screen answers the question before it is answered. The immune
 * card drew "What is this? Antibody" above a button reading Antibody.
 */
const IMMUNE = {
  pattern: 'threePeriod', prompt: 'Match each immune system component to its role.', seed: 1,
  payload: {
    items: [
      { id: 'pathogen', label: 'Pathogen', imageUrl: 'asset:bacterial-cell' },
      { id: 'antibody', label: 'Antibody' },
      { id: 'memory', label: 'Memory cell', imageUrl: 'asset:neuron' },
    ],
    phases: ['present', 'identify', 'recall'],
  },
  success: { kind: 'pairing', pairs: [['pathogen', 'Pathogen'], ['antibody', 'Antibody'], ['memory', 'Memory cell']] },
}
const activity = (spec: Record<string, unknown>) => ({ type: 'createActivity', id: 'm1', spec })

describe('selfAnswerFaults', () => {
  it('refuses a naming card with an item that has no picture to name', () => {
    expect(selfAnswerFaults(activity(IMMUNE)).join(' ')).toMatch(/"Antibody" has no picture, so the card would show its name as the answer/)
  })

  it('refuses a sort whose bin is called what one of its items is', () => {
    const sort = {
      pattern: 'sort', prompt: 'Sort them.', seed: 1,
      payload: { bins: [{ id: 'b1', label: 'Antibody' }, { id: 'b2', label: 'Cell' }], items: [{ id: 'i1', label: 'antibody', binId: 'b1' }, { id: 'i2', label: 'Phagocyte', binId: 'b2' }] },
      success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
    }
    expect(selfAnswerFaults(activity(sort)).join(' ')).toMatch(/"Antibody" is both a box and a piece/)
  })

  it('refuses a material whose box is headed with a piece’s own name', () => {
    const material = {
      prompt: 'Name the parts.',
      pieces: [{ id: 'p1', label: 'Nucleus', traits: {} }, { id: 'p2', label: 'Vacuole', traits: {} }],
      groups: [{ id: 'g1', label: 'Nucleus', ordered: false }, { id: 'g2', label: 'Vacuole', ordered: false }],
      slots: [{ id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 1 }, { id: 's2', groupId: 'g2', x: 0, y: 0, capacity: 1 }],
      rules: [],
      goal: { kind: 'binAssignment', assign: { p1: 'g1', p2: 'g2' } },
    }
    expect(selfAnswerFaults({ type: 'build_material', id: 'm2', spec: material }).join(' ')).toMatch(/"Nucleus" is both a box and a piece/)
  })

  it('refuses a sequence whose rules name every neighbouring pair: the list reads out the order', () => {
    const items = [{ id: 'a', label: 'Egg' }, { id: 'b', label: 'Larva' }, { id: 'c', label: 'Pupa' }]
    const seq = (rules: unknown[]) => activity({
      pattern: 'sequence', prompt: 'Order the life cycle.', payload: { items, rules }, success: { kind: 'exactOrder', itemIds: ['a', 'b', 'c'] },
    })
    const whole = [{ text: 'The egg comes before the larva', before: 'a', after: 'b' }, { text: 'The larva comes before the pupa', before: 'b', after: 'c' }]
    expect(selfAnswerFaults(seq(whole)).join(' ')).toMatch(/rules spell out the whole order/)
    // One pair left to work out, or a rule that skips a step, is a clue and not the answer.
    expect(selfAnswerFaults(seq(whole.slice(0, 1)))).toEqual([])
    expect(selfAnswerFaults(seq([{ text: 'The egg comes before the pupa', before: 'a', after: 'c' }]))).toEqual([])
  })

  it('passes a naming card whose every item has a picture', () => {
    const fine = { ...IMMUNE, payload: { ...IMMUNE.payload, items: [{ id: 'a', label: 'Plant cell', imageUrl: 'asset:plant-cell' }, { id: 'b', label: 'Animal cell', imageUrl: 'asset:animal-cell' }, { id: 'c', label: 'Bacterium', imageUrl: 'asset:bacterial-cell' }] } }
    expect(selfAnswerFaults(activity(fine))).toEqual([])
  })
})

describe('the naming card never names what it asks', () => {
  const card = (work: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1',
      data: { spec: IMMUNE, activityState: { status: 'in_progress', attempts: 0, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work } },
    } as never)))

  it('asks "What is this?" without printing the name as the picture, or in its alt text', () => {
    const html = card({ phase: 2, answers: {}, presentIdx: 3, identifyIdx: 3 })
    expect(html).toContain('What is this?')
    // The tile before the choices: no name in it, and no picture says its name.
    const tile = html.slice(html.indexOf('What is this?'), html.indexOf('What is this?') + 900)
    expect(tile).not.toMatch(/alt="(Pathogen|Antibody|Memory cell)"/)
    expect(tile).not.toMatch(/>(Pathogen|Antibody|Memory cell)<\/div>/)
  })

  it('in "Show me", the pictures to choose from do not say which is which', () => {
    const html = card({ phase: 1, answers: {}, presentIdx: 3, identifyIdx: 0 })
    expect(html).toMatch(/Show me:/)
    expect(html).not.toMatch(/alt="(Pathogen|Antibody|Memory cell)"/)
  })
})
