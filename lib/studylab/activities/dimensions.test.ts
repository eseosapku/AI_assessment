// lib/studylab/activities/dimensions.test.ts
import { describe, it, expect } from 'vitest'
import { DIMENSIONS, dimensionsOf } from './dimensions'
import type { ActivitySpec } from './types'

const spec = (pattern: string, payload: unknown): ActivitySpec =>
  ({ pattern, prompt: 'p', payload, success: { kind: 'exactSet', itemIds: [] } }) as ActivitySpec

describe('dimensionsOf', () => {
  it('names what a sorting frame varies', () => {
    expect(
      dimensionsOf(spec('sort', {
        bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Sulfur', binId: 'b2' }],
      })),
    ).toEqual(['category'])
  })

  it('names what a balance varies', () => {
    expect(
      dimensionsOf(spec('balance', {
        left: [], right: [], mode: 'weights',
        pool: [{ id: 'p1', label: '3', weight: 3 }, { id: 'p2', label: '5', weight: 5 }],
      })),
    ).toEqual(['quantity'])
  })

  it('reads the balance mode, because an equation varies structure not quantity', () => {
    expect(
      dimensionsOf(spec('balance', { left: [], right: [], pool: [], mode: 'equation' })),
    ).toEqual(['structure'])
  })

  it('names what a two-set comparison varies', () => {
    expect(
      dimensionsOf(spec('compare', {
        sets: [{ id: 'a', label: 'Plant' }, { id: 'b', label: 'Animal' }],
        items: [
          { id: 'i1', label: 'Cell wall', belongs: 'left' },
          { id: 'i2', label: 'Nucleus', belongs: 'both' },
        ],
      })),
    ).toEqual(['membership'])
  })

  it('says a sorting frame with one bin varies nothing', () => {
    // The degenerate material: every item goes in the same place, so there is
    // no decision to make. Without this it would pass the intent check on the
    // strength of its pattern name alone.
    expect(
      dimensionsOf(spec('sort', {
        bins: [{ id: 'b1', label: 'Metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Tin', binId: 'b1' }],
      })),
    ).toEqual([])
  })

  it('says a balance whose weights are all equal varies nothing', () => {
    expect(
      dimensionsOf(spec('balance', {
        left: [], right: [], mode: 'weights',
        pool: [{ id: 'p1', label: '4', weight: 4 }, { id: 'p2', label: '4', weight: 4 }],
      })),
    ).toEqual([])
  })

  it('says a slider that cannot move varies nothing', () => {
    expect(
      dimensionsOf(spec('vary', { variable: { id: 'v', label: 'x', min: 5, max: 5, step: 1 } })),
    ).toEqual([])
  })

  it('says a single card names nothing', () => {
    expect(dimensionsOf(spec('threePeriod', { items: [{ id: 'i1', label: 'Neuron' }] }))).toEqual([])
  })

  it('says two three-period cards sharing one label name nothing', () => {
    // The deck shows the WORD "Neuron" and asks the student to pick "Neuron"
    // again — two ids, but one name. isPayload only dedupes on id, so this
    // shape is allowed through; counting items instead of labels would have
    // let it pass an `isolates: 'identity'` claim on the strength of a
    // headcount, not on anything the card actually names.
    expect(
      dimensionsOf(spec('threePeriod', {
        items: [{ id: 'i1', label: 'Neuron' }, { id: 'i2', label: 'Neuron' }],
      })),
    ).toEqual([])
  })

  it('says a scenario whose choices share one consequence varies nothing', () => {
    // Two choices, one outcome: whichever the student picks, nothing changes.
    // isPayload only requires each consequence be non-empty, never that they
    // differ, so counting choices instead of reading consequences would have
    // let this pass an `isolates: 'consequence'` claim with no decision in it.
    expect(
      dimensionsOf(spec('scenario', {
        choices: [
          { id: 'c1', label: 'Ignore it', consequence: 'Nothing changes.' },
          { id: 'c2', label: 'Report it', consequence: 'Nothing changes.' },
        ],
      })),
    ).toEqual([])
  })

  it('covers every registered pattern when the payload is non-degenerate', () => {
    // A pattern with no dimension could never state what it isolates, so it
    // could never pass the intent check and would be silently unusable.
    const two = [{ id: 'a' }, { id: 'b' }]
    const payloads: Record<string, unknown> = {
      threePeriod: { items: [{ id: 'a', label: 'Neuron' }, { id: 'b', label: 'Axon' }] },
      sort: { bins: two, items: [{ id: 'i1', binId: 'a' }, { id: 'i2', binId: 'b' }] },
      label: { hotspots: two },
      sequence: { items: two },
      vary: { variable: { min: 0, max: 10 } },
      balance: { mode: 'weights', pool: [{ weight: 1 }, { weight: 2 }], left: [], right: [] },
      compare: { items: [{ belongs: 'left' }, { belongs: 'right' }] },
      scenario: { choices: [{ id: 'a', consequence: 'x' }, { id: 'b', consequence: 'y' }] },
      compose: { parts: two },
    }
    for (const [pattern, payload] of Object.entries(payloads)) {
      expect(dimensionsOf(spec(pattern, payload)).length, pattern).toBe(1)
    }
  })

  it('only ever returns names from the closed vocabulary', () => {
    for (const pattern of ['sort', 'balance', 'vary', 'compose']) {
      for (const d of dimensionsOf(spec(pattern, { mode: 'equation' }))) {
        expect(DIMENSIONS).toContain(d)
      }
    }
  })

  it('never throws on a malformed payload', () => {
    expect(dimensionsOf(spec('sort', null))).toEqual([])
    expect(dimensionsOf({} as never)).toEqual([])
  })
})
