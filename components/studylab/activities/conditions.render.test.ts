// components/studylab/activities/conditions.render.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from './ActivityNode'

const card = (spec: unknown) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec } } as never)))

describe('constraint answers on the board', () => {
  it('lists a sequence\'s rules under it, each one unticked until it holds', () => {
    const html = card({
      pattern: 'sequence',
      prompt: 'Put the phases in order.',
      payload: {
        items: [{ id: 'a', label: 'Prophase' }, { id: 'b', label: 'Metaphase' }, { id: 'c', label: 'Anaphase' }],
        rules: [{ text: 'Prophase comes before anaphase', before: 'a', after: 'c' }],
      },
      success: { kind: 'exactOrder', itemIds: ['a', 'b', 'c'] },
    })
    expect(html).toMatch(/aria-label="Rules"/)
    expect(html).toMatch(/Prophase comes before anaphase/)
  })

  it('shows a balance its one condition', () => {
    const html = card({
      pattern: 'balance',
      prompt: 'Make the beam level.',
      payload: { left: [{ id: 'l', label: 'x', weight: 3 }], right: [], pool: [{ id: 'p', label: '1', weight: 1 }, { id: 'q', label: '2', weight: 2 }], mode: 'weights' },
      success: { kind: 'numericWithin', target: 0, tolerance: 0 },
    })
    expect(html).toMatch(/Both sides weigh the same/)
    expect(html).toMatch(/\(not yet\)/)
  })

  it('lists nothing under a sequence written without rules', () => {
    const html = card({
      pattern: 'sequence',
      prompt: 'Put the phases in order.',
      payload: { items: [{ id: 'a', label: 'Prophase' }, { id: 'b', label: 'Metaphase' }] },
      success: { kind: 'exactOrder', itemIds: ['a', 'b'] },
    })
    expect(html).not.toMatch(/aria-label="Rules"/)
  })
})
