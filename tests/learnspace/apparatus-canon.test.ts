import { describe, it, expect } from 'vitest'
import { apparatusNames, getApparatus } from '@/lib/studylab/material/canon'

const weight = (id: string, n: number) => ({ id, label: id, weight: n })

describe('the material canon', () => {
  it('serves the nine apparatuses and nothing a model invents', () => {
    expect(apparatusNames()).toEqual([
      'sorting-frame', 'ordering-track', 'three-period-cards', 'venn-sets', 'balance-beam',
      'labelled-diagram', 'variable-model', 'decision-branch', 'bonding-ring',
    ])
    expect(getApparatus('__proto__')).toBeNull()
    expect(getApparatus('constructor')).toBeNull()
  })

  it('converts a legacy balance into a material that can be played', () => {
    const beam = getApparatus('balance-beam')
    const spec = beam?.legacy?.fromLegacy({
      mode: 'weights',
      left: [weight('a', 1)],
      right: [weight('b', 1)],
      pool: [weight('c', 2)],
    })
    expect(spec?.pieces.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(spec?.goal).toMatchObject({ kind: 'numericWithin', target: 0 })
  })

  it('refuses a balance payload that is not a balance', () => {
    expect(getApparatus('balance-beam')?.legacy?.fromLegacy({ mode: 'weights', left: [], right: [], pool: [] })).toBeNull()
    expect(getApparatus('balance-beam')?.legacy?.fromLegacy(null)).toBeNull()
  })
})
