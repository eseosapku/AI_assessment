// lib/studylab/plainTitle.test.ts
import { describe, it, expect } from 'vitest'
import { plainTitle, applyActions } from './actions'
import type { CanvasState, TutorAction } from './types'

describe('plainTitle', () => {
  it('takes the markdown off a title the model wrote', () => {
    // Straight from a real board: the asterisks were on the canvas.
    expect(plainTitle('*In Vivo* vs. *In Vitro*')).toBe('In Vivo vs. In Vitro')
    expect(plainTitle('**Activation Energy**')).toBe('Activation Energy')
    expect(plainTitle('***Osmosis***')).toBe('Osmosis')
    expect(plainTitle('`useEffect` in practice')).toBe('useEffect in practice')
    expect(plainTitle('## Reaction Rates')).toBe('Reaction Rates')
    expect(plainTitle('[Enzymes](https://x.test/enzymes)')).toBe('Enzymes')
    expect(plainTitle('__Bold__ and _italic_')).toBe('Bold and italic')
  })

  it('leaves a title that only looks like markdown alone', () => {
    // Multiplication and identifiers are not emphasis.
    expect(plainTitle('Why 3 * 4 is not 3 + 4')).toBe('Why 3 * 4 is not 3 + 4')
    expect(plainTitle('Reading a snake_case_name')).toBe('Reading a snake_case_name')
    expect(plainTitle('Rates')).toBe('Rates')
  })

  it('tidies the whitespace it leaves behind', () => {
    expect(plainTitle('  Enzymes   and   rates  ')).toBe('Enzymes and rates')
  })
})

describe('a card arriving with markdown in its title', () => {
  const empty: CanvasState = { nodes: [], edges: [] }

  it('lands on the board with the title a learner should read', () => {
    const actions: TutorAction[] = [
      { type: 'createCard', id: 'c1', card: 'concept', title: '*In Vivo* vs. *In Vitro*', body: 'x', step: 3 } as TutorAction,
    ]
    const out = applyActions(empty, actions)
    expect(out.nodes[0].data.title).toBe('In Vivo vs. In Vitro')
  })

  it('cleans a title arriving through an in-place edit too', () => {
    const created = applyActions(empty, [
      { type: 'createCard', id: 'c1', card: 'concept', title: 'Enzymes', body: 'x', step: 1 } as TutorAction,
    ])
    const edited = applyActions(
      { nodes: created.nodes, edges: created.edges },
      [{ type: 'updateCard', id: 'c1', title: '**Enzymes**, simply' } as TutorAction],
    )
    expect(edited.nodes[0].data.title).toBe('Enzymes, simply')
  })
})
