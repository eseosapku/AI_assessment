// lib/studylab/lessonCards.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

/**
 * A card on the board shows what was written for the lesson. Converted to the
 * generic materials, five kinds lost it: a labelling card lost its diagram and
 * printed each answer on its own target, a scenario lost its situation and
 * consequences, a build card its target and formula, the three-period cards
 * their first two periods, a weights balance its weights. A river lesson's
 * slider read "Move the control until the model reaches its target".
 *
 * Rendered on the server, as the learner would first see each card.
 */
vi.spyOn(console, 'error').mockImplementation(() => {})

const card = (spec: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec } } as never)))

describe('a lesson card shows what the lesson wrote', () => {
  it('labelling: the diagram is drawn, and no answer is printed on its target', () => {
    const html = card({
      pattern: 'label', prompt: 'Label the plant cell.', seed: 3,
      payload: { image: { imageUrl: 'asset:plant-cell', width: 300, height: 200 }, hotspots: [{ id: 'h1', x: 50, y: 60, r: 12, label: 'Nucleus' }, { id: 'h2', x: 150, y: 90, r: 12, label: 'Vacuole' }] },
      success: { kind: 'pairing', pairs: [['h1', 'Nucleus'], ['h2', 'Vacuole']] },
    })
    expect(html).toContain('/art/montessori/diagrams/plant-cell.webp')
    expect(html).toContain('Label the plant cell.')
  })

  it('scenario: the situation and its picture are there to decide on', () => {
    const html = card({
      pattern: 'scenario', prompt: 'What should the town do?', seed: 1,
      payload: {
        situation: 'The river floods the town every spring.', imageUrl: 'asset:river-profile',
        choices: [{ id: 'c1', label: 'Build levees', consequence: 'The town stays dry, downstream floods worse.', defensible: true }, { id: 'c2', label: 'Do nothing', consequence: 'The town floods again.' }],
      },
      success: { kind: 'exactSet', itemIds: ['c1'] },
    })
    expect(html).toContain('The river floods the town every spring.')
    expect(html).toContain('/art/montessori/diagrams/river-profile.webp')
  })

  it('build: the target and its formula are named', () => {
    const html = card({
      pattern: 'compose', prompt: 'Join the atoms.', seed: 1,
      payload: {
        parts: [{ id: 'o', label: 'O', slots: 2 }, { id: 'h1', label: 'H', slots: 1 }, { id: 'h2', label: 'H', slots: 1 }],
        validJoins: [{ a: 'O', b: 'H' }],
        target: { label: 'Water', formula: 'H2O' },
      },
    })
    expect(html).toContain('Water')
    expect(html).toContain('H2O')
  })

  it('three-period: it starts by presenting the thing, not by matching a name to itself', () => {
    const html = card({
      pattern: 'threePeriod', prompt: 'Learn the planets.', seed: 1,
      payload: { items: [{ id: 'p1', label: 'Mars' }, { id: 'p2', label: 'Venus' }], phases: ['present', 'identify', 'recall'] },
      success: { kind: 'pairing', pairs: [['p1', 'Mars'], ['p2', 'Venus']] },
    })
    expect(html).toMatch(/This is/)
  })

  it('weights balance: each weight is shown', () => {
    const html = card({
      pattern: 'balance', prompt: 'Balance the scale.', seed: 1,
      payload: { left: [{ id: 'l1', label: 'Box', weight: 5 }], right: [], pool: [{ id: 'p1', label: 'Bag', weight: 3 }, { id: 'p2', label: 'Tin', weight: 2 }], mode: 'weights' },
      success: { kind: 'numericWithin', target: 0, tolerance: 0 },
    })
    expect(html).toContain('+3')
    expect(html).toContain('+2')
  })

  it('slider: the instruction written for it, never the converter\'s placeholder', () => {
    const html = card({
      pattern: 'vary', prompt: "Move the slider to change the river's gradient.", seed: 1,
      payload: {
        variable: { id: 'g', label: 'Gradient', min: 0, max: 20, step: 1, unit: 'degrees' },
        model: { kind: 'bars', bars: [{ label: 'Flow speed', expr: 'g * 2', max: 40 }] },
        readouts: [{ label: 'Flow speed', expr: 'g * 2', unit: 'cm/s' }],
        scene: 'asset:river-profile',
      },
      success: { kind: 'numericWithin', target: 10, tolerance: 1 },
    })
    expect(html).toContain("Move the slider to change the river&#x27;s gradient.")
    expect(html).not.toContain('Move the control until the model reaches its target')
    expect(html).toContain('/art/montessori/diagrams/river-profile.webp')
  })
})

describe('a sort does not give its answer away by its order', () => {
  it('shows the items out of the order they were written in, the same way every time', () => {
    const items = ['Iron', 'Copper', 'Zinc', 'Sulfur', 'Carbon', 'Oxygen']
    const spec = {
      pattern: 'sort', prompt: 'Sort the elements.', seed: 7,
      payload: {
        bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
        items: items.map((label, i) => ({ id: `i${i}`, label, binId: i < 3 ? 'b1' : 'b2' })),
      },
      success: { kind: 'binAssignment', assign: Object.fromEntries(items.map((_, i) => [`i${i}`, i < 3 ? 'b1' : 'b2'])) },
    }
    const order = (html: string) => items.map((l) => [l, html.indexOf(`>${l}<`)] as const).filter(([, at]) => at >= 0).sort((a, b) => a[1] - b[1]).map(([l]) => l)
    const shown = order(card(spec))
    expect(shown).toHaveLength(items.length)
    expect(shown).not.toEqual(items)
    expect(order(card(spec))).toEqual(shown)
  })
})
